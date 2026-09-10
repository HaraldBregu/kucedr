import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
	clearMessages as clearSessionMessages,
	deleteSession as deleteStoredSession,
	createSessionState,
	init,
	listSessions,
	loadMessages,
	renameSession as renameStoredSession,
	resolveSessionId,
	resolveStoredSessionId,
	tryAppendRun,
	updateUserMessageBySessionId,
	type SessionResult,
	addAssistantMessage,
	sessionDir,
} from './session';
import { SessionCoordinator } from './session/coordinator';
import { releaseSession } from './session/release';
import { accountGoalRun } from './goal/account';
import { applyGoalCommand } from './goal/apply';
import { parseGoalCommand } from './goal/parse';
import { stream } from './runner/run_stream';
import { agentLocation } from '../shared/agent_location';
import {
	associateSession,
	destroyTask,
	getRuntime,
	initTask,
	setTaskRunner,
	startTask,
} from '../tasks';
import { startHealth, stopHealth } from './health';
import { rejectPendingToolPermissions } from './permissions';
import { interruptPendingUserInput } from './user_input/user_input_pending';
import { parseSkillCommand } from './skills';
import type { Config, Message, RuntimeEvent, RuntimeInput } from './types';
import type {
	AgentRunOptions,
	AgentHistoryContentBlock,
	AgentSessionSnapshot,
	AgentHistoryMessage,
	AgentPromptInputCapabilities,
	AgentResponseEvent,
	AgentRunStopReason,
	AgentSessionSummary,
} from '../../shared/agent_types';
import { toError } from '../ipc/core/error';
import { AgentRunScheduler, type AgentRunPriority } from './agent_scheduler';
import type { WindowFactory } from '../window_factory';
import type { SessionCategory } from './session';
import { KeyedLimiter } from './limiter';
import { KeyedMutex } from './mutex';
import type { ExecSandbox } from './sandbox';
import {
	admitRun,
	beginRun,
	cancelRun,
	completeRun,
	createRunRegistry,
	type AgentRunOutcome,
	type AgentRunRecord,
} from './state';
import { getModelId, getProviderId } from './agent_store';
import { preflightPromptAttachments, resolvePromptInputCapabilities } from './attachments';
import { workspacePath } from './system';
import { formatReplyMessage } from '../../shared/reply';

const RUN_PRIORITIES: Record<SessionCategory, AgentRunPriority> = {
	main: 'high',
	bot: 'normal',
	health: 'low',
	task: 'low',
	subagent: 'low',
};

const AGENT_CATEGORIES: Record<string, SessionCategory> = {
	main: 'main',
	channels: 'bot',
	tasks: 'task',
	health: 'health',
};

const SCHEDULED_TASK_TOOLS_DENY = [
	'create_task',
	'update_task',
	'pause_task',
	'resume_task',
	'delete_task',
	'run_task_now',
];

type AgentSendBaseOptions = Omit<AgentRunOptions, 'toolsAllow'> & {
	streaming?: boolean;
	modelId?: string;
	windowId?: number;
	streamEvent?: (event: AgentResponseEvent) => void;
};

export type AgentSendOptions =
	| (AgentSendBaseOptions & { type: 'default'; toolsAllow?: string[] })
	| (AgentSendBaseOptions & { type: 'background'; toolsAllow?: string[] });

type InternalAgentSendOptions = AgentSendOptions & { legacySessionId?: string };

export class Agent {
	private readonly runs = createRunRegistry<InternalAgentSendOptions>();
	private readonly scheduler = new AgentRunScheduler(3);
	readonly resources = new KeyedMutex();
	readonly sessions = new SessionCoordinator();
	private readonly providerLimiter = new KeyedLimiter(3);
	private readonly subagentLimiter = new KeyedLimiter(3);
	private readonly lastMessagesLimit = 50;
	private isStarted = false;
	readonly config: Config;

	constructor(
		private readonly windowFactory: WindowFactory,
		readonly sandbox: ExecSandbox
	) {
		this.config = { location: path.resolve(agentLocation()) };
		workspacePath(this.config);
		initTask();
	}

	start(logger: {
		info(scope: string, message: string, data?: unknown): void;
		error(scope: string, message: string, error?: unknown): void;
	}): void {
		if (this.isStarted) return;
		this.isStarted = true;
		setTaskRunner((schedule) => {
			const runtime = getRuntime();
			const toolsAllow = schedule.toolsAllow;
			const sessionId = randomUUID();
			associateSession(schedule.id, sessionId);
			return this.send(schedule.prompt, 'tasks', {
				type: 'background',
				sessionId,
				...(toolsAllow?.length ? { toolsAllow } : {}),
				toolsDeny: SCHEDULED_TASK_TOOLS_DENY,
				streaming: false,
				contextMode: 'minimal',
				effort: schedule.effort,
				...(runtime ? { providerId: runtime.providerId, modelId: runtime.modelId } : {}),
			});
		});
		void startTask().catch((error) => {
			logger.error('Task', 'Failed to start persistent tasks scheduler', error);
		});
		startHealth(this, logger);
	}

	destroy(): void {
		this.cancelAll();
		stopHealth();
		setTaskRunner(undefined);
		destroyTask();
		void this.sandbox.reset();
	}

	async send(message: string, agentId: string, options: AgentSendOptions): Promise<string> {
		const normalizedAgentId = agentId.trim();
		const category = AGENT_CATEGORIES[normalizedAgentId] ?? 'main';
		const sessionId = resolveSessionId(options.sessionId, this.config.location, category);
		const runId = options.runId ?? randomUUID();
		const pinnedProviderId = options.providerId?.trim() || getProviderId();
		const pinnedModelId = (options.model ?? options.modelId)?.trim() || getModelId();
		const commandOptions: InternalAgentSendOptions = {
			...options,
			sessionId,
			...(pinnedProviderId ? { providerId: pinnedProviderId } : {}),
			...(pinnedModelId ? { model: pinnedModelId, modelId: pinnedModelId } : {}),
			...(options.sessionId && options.sessionId !== sessionId
				? { legacySessionId: options.sessionId }
				: {}),
		};
		const record = admitRun(this.runs, {
			id: runId,
			agentId: normalizedAgentId,
			sessionId,
			category,
			message,
			options: commandOptions,
			queuedAt: Date.now(),
			...(options.windowId === undefined ? {} : { windowId: options.windowId }),
		});
		const scheduled = this.scheduler.run(sessionId, () => this.process(record), {
			priority: RUN_PRIORITIES[category],
			signal: record.controller.signal,
		});
		const completion = scheduled.catch((error): AgentRunOutcome => {
			if (record.lifecycle.status === 'cancelling' && !record.lifecycle.session) {
				return { text: '', stopReason: 'cancelled' };
			}
			throw error;
		});
		record.completion = completion;
		const cleanup = () => {
			completeRun(this.runs, record);
		};
		void completion.then(cleanup, cleanup);
		return completion.then((outcome) => outcome.text);
	}

	private async process(
		record: AgentRunRecord<InternalAgentSendOptions>
	): Promise<AgentRunOutcome> {
		const { request, controller } = record;
		const { options } = request;
		const session = createSessionState();
		if (!beginRun(record, session)) return { text: '', stopReason: 'cancelled' };

		let response = '';
		let result: SessionResult | undefined;
		try {
			if (controller.signal.aborted) return { text: '', stopReason: 'cancelled' };
			const parsedGoalCommand =
				request.category === 'main' ? parseGoalCommand(request.message) : undefined;
			const parsedSkillCommand = parseSkillCommand(
				parsedGoalCommand?.action === 'create' ? parsedGoalCommand.objective : request.message
			);
			const providerId = options.providerId;
			const modelId = options.model ?? options.modelId;
			const promptCapabilities = resolvePromptInputCapabilities(providerId, modelId);
			const files = options.files?.length
				? promptCapabilities
					? preflightPromptAttachments(options.files, promptCapabilities)
					: (() => {
							throw new Error('Attachments require a valid configured prompt model.');
						})()
				: [];

			const baseInput: Omit<RuntimeInput, 'type' | 'toolsAllow'> = {
				runId: request.id,
				task: 'chat',
				message: formatReplyMessage(parsedSkillCommand.message, options.replyTo),
				scope: { ownerId: `${request.category === 'main' ? 'interactive' : request.agentId}:${request.sessionId}`, source: request.category === 'main' ? 'interactive' : request.category === 'bot' ? 'channel' : request.category === 'task' ? 'task' : request.category === 'health' ? 'health' : 'child', sessionId: request.sessionId, runId: request.id },
				agentId: request.agentId,
				contextMode:
					options.contextMode ??
					(options.lightContext === true || request.category !== 'main' ? 'minimal' : 'workspace'),
				interactionMode:
					request.category === 'main' && options.interactionMode === 'plan' ? 'plan' : 'default',
				...(options.effort ? { effort: options.effort } : {}),
				...(options.toolsDeny ? { toolsDeny: options.toolsDeny } : {}),
				...(files.length ? { files } : {}),
				...(promptCapabilities ? { promptCapabilities } : {}),
				...(files.length ? { deferPersist: true } : {}),
				...(options.sessionId ? { sessionId: options.sessionId } : {}),
				...(options.legacySessionId ? { legacySessionId: options.legacySessionId } : {}),
				...(providerId ? { providerId } : {}),
				...(modelId ? { model: modelId } : {}),
				...(options.windowId === undefined || options.streamEvent === undefined
					? {}
					: { approvalWindowId: options.windowId }),
				...(parsedSkillCommand.explicitSkill
					? { explicitSkill: parsedSkillCommand.explicitSkill }
					: {}),
			};
			const input: RuntimeInput =
				options.type === 'background'
					? {
							...baseInput,
							type: 'background',
							...(options.toolsAllow === undefined ? {} : { toolsAllow: options.toolsAllow }),
						}
					: {
							...baseInput,
							type: 'default',
							...(options.toolsAllow === undefined ? {} : { toolsAllow: options.toolsAllow }),
						};

			init(session, this.config, input, request.category, this.sessions);
			if (parsedGoalCommand) {
				const reply = applyGoalCommand(sessionDir(session), parsedGoalCommand);
				if (parsedGoalCommand.action === 'create') {
					response = reply;
				} else {
					addAssistantMessage(session, reply, []);
				this.emit(record, { type: 'text_delta', delta: reply, agentId: request.agentId, runId: request.id });
				this.emit(record, {
					type: 'run_finished',
					stopReason: 'end_turn',
					outputChars: reply.length,
					agentId: request.agentId,
					runId: request.id,
				});
					return { text: reply, stopReason: 'end_turn' };
				}
			}
			tryAppendRun(session, {
				type: 'run_queue_metrics',
				queueDelayMs: Date.now() - request.queuedAt,
			});

			const timeoutSignal = AbortSignal.timeout(10 * 60_000);
			const runSignal = AbortSignal.any([controller.signal, timeoutSignal, ...(session.lease ? [session.lease.signal] : [])]);
			const events = stream(this.config, session, input, runSignal, {
				streaming: options.streaming ?? true,
				windowFactory: this.windowFactory,
				resources: this.resources,
				sandbox: this.sandbox,
				providerLimiter: this.providerLimiter,
				subagentLimiter: this.subagentLimiter,
			});

			const streamingToolArgs = new Map<string, { name: string; argsText: string }>();
			for await (const event of events) {
				if (event.type === 'model_call_delta') response += event.delta;
				if (event.type === 'run_finished') {
					result = event.result;
					response = event.result.text || response;
				}

				for (const responseEvent of runtimeEventToAgentEvents(
					event,
					request.agentId,
					request.id,
					streamingToolArgs
				)) {
					this.emit(record, responseEvent);
				}
			}
			if (result && request.category === 'main' && session.folderName !== '') {
				accountGoalRun(sessionDir(session), result.usage ?? { inputTokens: 0, outputTokens: 0 }, result.toolCalls.length);
			}
			return {
				text: response,
				stopReason: result
					? normalizeStopReason(result.stopReason)
					: controller.signal.aborted
						? 'cancelled'
						: 'end_turn',
				...(result ? { result } : {}),
			};
		} catch (error) {
			if (controller.signal.aborted) {
				return { text: response, stopReason: 'cancelled', ...(result ? { result } : {}) };
			}
			const cause = toError(error, 'Agent request failed.');
			throw cause;
		} finally {
			releaseSession(session);
		}
	}

	private emit(
		record: AgentRunRecord<InternalAgentSendOptions>,
		event: AgentResponseEvent
	): void {
		record.responseEvents.push(event);
		record.request.options.streamEvent?.(event);
	}

	getSessionSnapshot(sessionId: string): AgentSessionSnapshot {
		const active = [...this.runs.values()].find(
			(record) => record.request.category === 'main' && record.request.sessionId === sessionId
		);
		return {
			messages: this.getLastMessages(sessionId),
			...(active
				? {
						activeRun: {
							runId: active.request.id,
							message: formatReplyMessage(active.request.message, active.request.options.replyTo),
							status: active.lifecycle.status,
							events: [...active.responseEvents],
						},
					}
				: {}),
		};
	}

	listSessions(): AgentSessionSummary[] {
		const sessions = listSessions(this.config.location);
		const byId = new Map(sessions.map((session) => [session.id, session]));
		for (const record of this.runs.values()) {
			if (record.request.category !== 'main') continue;
			const stored = byId.get(record.request.sessionId);
			byId.set(record.request.sessionId, {
				id: record.request.sessionId,
				createdAtMs: stored?.createdAtMs ?? record.request.queuedAt,
				title: stored?.title ?? record.request.message.slice(0, 80),
				runStatus: record.lifecycle.status,
			});
		}
		return [...byId.values()].sort((left, right) => right.createdAtMs - left.createdAtMs);
	}

	renameSession(sessionId: string, title: string): Promise<void> {
		return this.scheduler.run(
			sessionId,
			async () => renameStoredSession(sessionId, this.config.location, title),
			{ priority: 'high' }
		);
	}

	getLastMessages(sessionId: string): AgentHistoryMessage[] {
		return loadMessages(this.config, sessionId)
			.slice(-this.lastMessagesLimit)
			.flatMap(toHistoryMessages);
	}

	getPromptInputCapabilities(): AgentPromptInputCapabilities | null {
		return resolvePromptInputCapabilities(getProviderId(), getModelId());
	}

	editUserMessage(sessionId: string, userOffsetFromEnd: number, content: string): Promise<boolean> {
		const resolvedSessionId = resolveStoredSessionId(sessionId, this.config.location);
		return this.scheduler.run(
			resolvedSessionId,
			async () =>
				updateUserMessageBySessionId(
					resolvedSessionId,
					this.config.location,
					userOffsetFromEnd,
					content,
					this.sessions
				),
			{ priority: 'high' }
		);
	}

	clearMessages(sessionId: string): Promise<void> {
		const resolvedSessionId = resolveStoredSessionId(sessionId, this.config.location);
		const completions = this.cancelSession(resolvedSessionId);
		return this.scheduler.run(
			resolvedSessionId,
			async () => {
				await Promise.allSettled(completions);
				clearSessionMessages(createSessionState(), this.config, resolvedSessionId, this.sessions);
			},
			{ priority: 'high' }
		);
	}

	deleteSession(sessionId: string): Promise<void> {
		const resolvedSessionId = resolveStoredSessionId(sessionId, this.config.location);
		const completions = this.cancelSession(resolvedSessionId);
		return this.scheduler.run(
			resolvedSessionId,
			async () => {
				await Promise.allSettled(completions);
				deleteStoredSession(createSessionState(), this.config, resolvedSessionId, this.sessions);
			},
			{ priority: 'high' }
		);
	}

	cancel(runId: string, windowId?: number): boolean {
		const record = this.runs.get(runId);
		if (!record || (windowId !== undefined && record.request.windowId !== windowId)) return false;
		const cancelled = cancelRun(record, new DOMException('Run cancelled.', 'AbortError'));
		if (!cancelled) return false;
		rejectPendingToolPermissions(runId);
		interruptPendingUserInput(runId);
		return true;
	}

	cancelAll(): void {
		rejectPendingToolPermissions();
		interruptPendingUserInput();
		for (const record of this.runs.values()) {
			cancelRun(record, new DOMException('Application shutting down.', 'AbortError'));
		}
	}

	cancelWindow(windowId: number): void {
		for (const record of this.runs.values()) {
			if (record.request.windowId === windowId) this.cancel(record.request.id, windowId);
		}
	}

	isBusy(agentId: string): boolean {
		return [...this.runs.values()].some((record) => record.request.agentId === agentId);
	}

	runningSkill(): string | undefined {
		for (const record of this.runs.values()) {
			if (record.lifecycle.status !== 'running') continue;
			const skill = record.lifecycle.session.runContext.loadedSkills.at(-1);
			if (skill) return skill.name;
		}
		return undefined;
	}

	private cancelSession(sessionId: string): Promise<AgentRunOutcome>[] {
		const matching = [...this.runs.values()].filter(
			(record) => record.request.sessionId === sessionId
		);
		const completions = matching.flatMap((record) =>
			record.completion ? [record.completion] : []
		);
		for (const record of matching) this.cancel(record.request.id);
		return completions;
	}
}

function normalizeStopReason(value: string | undefined): AgentRunStopReason {
	if (value === 'max_tokens') return 'max_tokens';
	if (value === 'max_iterations' || value === 'error_max_turns') return 'max_iterations';
	if (value === 'max_tool_calls') return 'max_tool_calls';
	if (value === 'budget_exhausted') return 'budget_exhausted';
	if (value === 'timeout') return 'timeout';
	if (value === 'cancelled') return 'cancelled';
	if (value === 'error') return 'error';
	return 'end_turn';
}

function outputText(output: unknown): string {
	if (typeof output === 'string') return output;
	try {
		return JSON.stringify(output);
	} catch {
		return String(output);
	}
}

function toHistoryMessages(message: Message): AgentHistoryMessage[] {
	if (message.role === 'system') return [];
	if (
		Array.isArray(message.content) &&
		message.content.length > 0 &&
		message.content.every((block) => block.internal === true)
	)
		return [];

	const content = toTextContent(message.content);

	if (message.role === 'assistant') {
		const messages: AgentHistoryMessage[] = [
			{
				role: 'assistant',
				content,
				contentBlocks: toHistoryContentBlocks(message),
				...(message.usage ? { usage: message.usage } : {}),
			},
		];
		for (const toolCall of message.toolCalls ?? []) {
			if (!toolCall.result) continue;
			const output = toTextContent(toolCall.result.content);
			const isError = toolCall.result.isError ?? output.startsWith('Error:');
			messages.push({
				role: 'tool',
				content: output,
				toolUseId: toolCall.id,
				isError,
				status: isError ? 'error' : 'ok',
				output,
			});
		}
		return messages;
	}

	return [{ role: 'user', content, contentBlocks: toHistoryContentBlocks(message) }];
}

function toHistoryContentBlocks(message: Message): AgentHistoryContentBlock[] {
	const blocks = Array.isArray(message.content)
		? message.content
				.map((block): AgentHistoryContentBlock | undefined => {
					if (block.type === 'text' && typeof block.text === 'string') {
						return { type: 'text', text: block.text };
					}
					if (
						(block.type === 'text_file' ||
							block.type === 'image' ||
							block.type === 'document' ||
							block.type === 'file') &&
						typeof block.name === 'string' &&
						typeof block.mimeType === 'string'
					) {
						const bytes =
							typeof block.bytes === 'number'
								? block.bytes
								: typeof block.base64 === 'string'
									? Buffer.from(block.base64, 'base64').length
									: 0;
						return {
							type: 'attachment',
							kind:
								block.type === 'text_file' ? 'text' : block.type === 'image' ? 'image' : 'document',
							name: block.name,
							mimeType: block.mimeType,
							bytes,
						};
					}
					return undefined;
				})
				.filter((block): block is AgentHistoryContentBlock => block !== undefined)
		: [];

	for (const toolCall of message.toolCalls ?? []) {
		blocks.push({
			type: 'tool_use',
			toolUseId: toolCall.id,
			toolName: toolCall.name,
			toolArgs: toolCall.args,
		});
	}

	return blocks;
}

function toTextContent(content: Message['content']): string {
	if (typeof content === 'string') return content;
	return content
		.map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
		.filter(Boolean)
		.join('\n');
}

function runtimeEventToAgentEvents(
	event: RuntimeEvent,
	agentId: string,
	runId: string,
	streamingToolArgs: Map<string, { name: string; argsText: string }>
): AgentResponseEvent[] {
	if (event.type === 'run_started') {
		return [
			{
				type: 'run_started',
				sessionId: event.sessionId,
				interactionMode: event.interactionMode,
				agentId,
				runId,
			},
			{ type: 'run_state', state: 'thinking', agentId, runId },
		];
	}
	if (event.type === 'run_error') {
		return [{ type: 'run_state', state: 'error', label: event.message, agentId, runId }];
	}
	if (event.type === 'model_call_start') {
		return [{ type: 'model_selected', model: event.model, effort: event.effort, agentId, runId }];
	}
	if (event.type === 'model_tool_call_start') {
		streamingToolArgs.set(event.id, { name: event.name, argsText: '' });
		return [
			{
				type: 'tool_call_start',
				iteration: 0,
				toolCallId: event.id,
				toolName: event.name,
				name: event.name,
				serviceKind: 'tool',
				agentId,
				runId,
			},
		];
	}
	if (event.type === 'model_tool_call_args_delta') {
		const pending = streamingToolArgs.get(event.id);
		if (!pending) return [];
		pending.argsText += event.jsonDelta;
		return [
			{
				type: 'tool_call_args_delta',
				iteration: 0,
				toolCallId: event.id,
				toolName: pending.name,
				jsonDelta: event.jsonDelta,
				argsText: pending.argsText,
				agentId,
				runId,
			},
		];
	}
	if (event.type === 'model_call_end') {
		return [{ type: 'model_usage', usage: event.usage, agentId, runId }];
	}
	if (event.type === 'model_call_delta') {
		return [{ type: 'text_delta', delta: event.delta, agentId, runId }];
	}
	if (event.type === 'tool_call_start') {
		return [
			{
				type: 'tool_call_start',
				iteration: 0,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				name: event.toolName,
				serviceKind: 'tool',
				agentId,
				runId,
			},
			{
				type: 'tool_call_input',
				iteration: 0,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				input: event.input,
				argsText: outputText(event.input),
				name: event.toolName,
				serviceKind: 'tool',
				agentId,
				runId,
			},
		];
	}
	if (event.type === 'tool_permission_request') {
		return [
			{
				type: 'tool_permission_request',
				approvalId: event.approvalId,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				input: event.input,
				mode: 'ask',
				targets: event.targets,
				reason: event.reason,
				persistable: event.persistable,
				allowOnce: event.allowOnce,
				expiresAt: event.expiresAt,
				inputFingerprint: event.inputFingerprint,
				agentId,
				runId,
			},
		];
	}
	if (event.type === 'user_input_request') {
		return [
			{
				...event,
				type: 'user_input_request',
				agentId,
				runId,
			},
			{ type: 'run_state', state: 'awaiting_input', agentId, runId },
		];
	}
	if (event.type === 'user_input_result') {
		return [
			{ ...event, type: 'user_input_result', agentId, runId },
			{ type: 'run_state', state: 'thinking', agentId, runId },
		];
	}
	if (event.type === 'tool_call_end') {
		const status = event.isError ? 'error' : 'ok';
		return [
			{
				type: 'tool_call_result',
				iteration: 0,
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				input: event.input,
				output: event.output,
				outputText: outputText(event.output),
				status,
				durationMs: event.durationMs,
				errorText: event.isError ? outputText(event.output) : undefined,
				name: event.toolName,
				serviceKind: 'tool',
				agentId,
				runId,
			},
		];
	}
	if (event.type === 'run_finished') {
		const stopReason = normalizeStopReason(event.result.stopReason);
		return [
			{
				type: 'run_finished',
				stopReason,
				outputChars: event.result.text.length,
				usage: event.result.usage,
				agentId,
				runId,
			},
		];
	}
	return [];
}
