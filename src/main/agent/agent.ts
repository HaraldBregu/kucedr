import type { MemoryService } from '../../shared/memory_types';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
	clearMessages as clearSessionMessages,
	deleteSession as deleteStoredSession,
	createSessionState,
	init,
	listSessions,
	loadMessages,
	renameSession as renameStoredSession,
	pinSession as pinStoredSession,
	categorizeSession as categorizeStoredSession,
	archiveSession as archiveStoredSession,
	resolveSessionId,
	resolveStoredSessionId,
	tryAppendRun,
	updateUserMessageBySessionId,
	type SessionResult,
	type SessionCategory,
} from './session';
import { SessionCoordinator } from './session/coordinator';
import { releaseSession } from './session/release';
import type { RunExtender } from './extension';
import { stream } from './runner/run_stream';
import {
	associateSession,
	destroyTask,
	getRuntime,
	initTask,
	setTaskRunner,
	startTask,
} from '../tasks';
import { startHealth, stopHealth } from '../health';
import { rejectPendingToolPermissions } from './permissions';
import { interruptPendingUserInput } from './user_input/user_input_pending';
import { parseSkillCommand } from './skills';
import type { Config, RunSignal, RuntimeEvent, RuntimeInput } from './types';
import type {
	AgentRunOptions,
	AgentFollowUp,
	AgentSessionSnapshot,
	AgentHistoryMessage,
	AgentPromptInputCapabilities,
	AgentResponseEvent,
	AgentRunStopReason,
	AgentSessionSummary,
	AgentCompactSessionResult,
} from '../../shared/agent_types';
import { toError } from '../ipc/core/error';
import { AgentRunScheduler, type AgentRunPriority } from './agent_scheduler';
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
import { getAgentProfileModel } from './agent_profiles';
import { preflightPromptAttachments, resolvePromptInputCapabilities } from './attachments';
import { workspacePath } from './system';
import { compactConversation } from './compaction/compact';
import { sessionType } from './session/session_session_type';
import { sessionFolderName } from './session/session_session_folder_name';
import { sessionPath } from './session/session_session_path';
import { toHistoryMessages } from './session/session_to_history_messages';
import { formatReplyMessage } from '../../shared/reply';
import type { AgentToolProfileId } from '../../shared/agent_tools';
import { registry } from './tools/core/process';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { currentWorkspace } from '../workspaces/current';
import { resolveWorkspace } from '../workspaces/resolve';
import { workspaceScope } from '../workspaces/scope';
import { withinWorkspace } from '../workspaces/within';
import type { Workspace } from '../workspaces/types';

const RUN_PRIORITIES: Record<SessionCategory, AgentRunPriority> = {
	main: 'high',
	health: 'low',
	task: 'low',
	subagent: 'low',
	voice: 'normal',
};

const AGENT_CATEGORIES: Record<string, SessionCategory> = {
	main: 'main',
	tasks: 'task',
	health: 'health',
};

const AGENT_TOOL_PROFILES: Record<string, AgentToolProfileId> = {
	main: 'chat',
	tasks: 'tasks',
	health: 'health',
};

const SCHEDULED_TASK_TOOLS_DENY = ['create_task', 'update_task', 'delete_task', 'run_task_now'];

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
	// ponytail: kept in memory per chat, so undo history is lost on restart; persist it if that matters
	private readonly histories = new Map<string, import('./history/types').FileHistory>();
	private isStarted = false;
	onRun?: (signal: RunSignal) => void;
	onActivity?: () => void;

	constructor(
		readonly sandbox: ExecSandbox,
		private readonly memories?: (workspace: Workspace) => MemoryService,
		private readonly extend?: RunExtender
	) {
		const workspace = resolveWorkspace(DEFAULT_WORKSPACE);
		workspacePath({ location: workspace.files, workspace });
		initTask();
	}

	get config(): Config {
		const workspace = currentWorkspace();
		return { location: path.resolve(workspace.files), workspace };
	}

	get memory(): MemoryService | undefined {
		return this.memories?.(currentWorkspace());
	}

	start(logger: {
		info(scope: string, message: string, data?: unknown): void;
		error(scope: string, message: string, error?: unknown): void;
	}): void {
		if (this.isStarted) return;
		this.isStarted = true;
		setTaskRunner(async (schedule, signal) => {
			const runtime = getRuntime();
			const sessionId = randomUUID();
			const runId = randomUUID();
			let failure: string | undefined;
			associateSession(schedule.id, sessionId);
			signal.addEventListener('abort', () => this.cancel(runId), { once: true });
			await withinWorkspace(schedule.workspaceId ?? DEFAULT_WORKSPACE, () =>
				this.send(schedule.prompt, 'tasks', {
					type: 'background',
					sessionId,
					runId,
					...(schedule.toolsAllow ? { toolsAllow: schedule.toolsAllow } : {}),
					toolsDeny: SCHEDULED_TASK_TOOLS_DENY,
					streamEvent: (event) => {
						if (event.type === 'run_state' && event.state === 'error') failure = event.label;
						if (event.type === 'run_finished' && event.stopReason === 'timeout')
							failure = 'The run timed out.';
						if (event.type === 'run_finished' && event.stopReason === 'error')
							failure ??= 'The run failed.';
					},
					streaming: false,
					contextMode: 'minimal',
					...(runtime
						? {
								providerId: runtime.providerId,
								modelId: runtime.modelId,
								modelOptions: runtime.options,
							}
						: {}),
				})
			);
			if (failure) throw new Error(failure);
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
		registry.terminate();
		void this.sandbox.reset();
	}

	async send(message: string, agentId: string, options: AgentSendOptions): Promise<string> {
		const normalizedAgentId = agentId.trim();
		const category = AGENT_CATEGORIES[normalizedAgentId] ?? 'main';
		const workspace = currentWorkspace();
		if (workspace.id !== DEFAULT_WORKSPACE && !existsSync(workspace.files))
			throw new Error('This workspace folder was not found. Locate it to continue.');
		const sessionId = resolveSessionId(
			options.sessionId,
			workspace.sessions,
			category,
			workspace.id
		);
		const runId = options.runId ?? randomUUID();
		const profile = AGENT_TOOL_PROFILES[normalizedAgentId] ?? 'chat';
		const profileModel =
			profile === 'chat'
				? { providerId: getProviderId(), modelId: getModelId() }
				: getAgentProfileModel(profile, 'textToText');
		const pinnedProviderId =
			options.providerId?.trim() || profileModel.providerId || getProviderId();
		const pinnedModelId =
			(options.model ?? options.modelId)?.trim() || profileModel.modelId || getModelId();
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
			workspaceId: workspace.id,
			...(options.windowId === undefined ? {} : { windowId: options.windowId }),
		});
		const run = { sessionId, category, windowId: options.windowId, workspaceId: workspace.id };
		this.onRun?.({ ...run, phase: 'started' });
		this.onActivity?.();
		const scheduled = this.scheduler.run(
			sessionId,
			() => workspaceScope.run(workspace, () => this.process(record)),
			{ priority: RUN_PRIORITIES[category], signal: record.controller.signal }
		);
		const completion = scheduled.catch((error): AgentRunOutcome => {
			if (record.lifecycle.status === 'cancelling' && !record.lifecycle.session) {
				return { text: '', stopReason: 'cancelled' };
			}
			throw error;
		});
		record.completion = completion;
		const cleanup = () => {
			completeRun(this.runs, record);
			this.onActivity?.();
		};
		void completion.then(cleanup, cleanup);
		void completion.then(
			({ stopReason, text }) => this.onRun?.({ ...run, phase: 'finished', stopReason, text }),
			() => this.onRun?.({ ...run, phase: 'finished', stopReason: 'error', text: '' })
		);
		return completion.then((outcome) => outcome.text);
	}

	private async process(
		record: AgentRunRecord<InternalAgentSendOptions>
	): Promise<AgentRunOutcome> {
		const { request, controller } = record;
		const { options } = request;
		const toolProfile = AGENT_TOOL_PROFILES[request.agentId] ?? 'chat';
		const session = createSessionState();
		if (!beginRun(record, session)) return { text: '', stopReason: 'cancelled' };
		if (request.category === 'main') {
			const history = this.histories.get(request.sessionId);
			if (history) session.runContext.fileHistory = history;
			else this.histories.set(request.sessionId, session.runContext.fileHistory);
		}

		let response = '';
		let result: SessionResult | undefined;
		let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
		try {
			if (controller.signal.aborted) return { text: '', stopReason: 'cancelled' };
			const providerId = options.providerId;
			const extension = this.extend?.({
				category: request.category,
				modeIds: options.modeIds ?? [],
				sessionDirectory: sessionPath(
					currentWorkspace().sessions,
					sessionFolderName(request.sessionId)
				),
				...(providerId ? { providerId } : {}),
				...((options.model ?? options.modelId) ? { modelId: options.model ?? options.modelId } : {}),
			});
			if (!extension && options.modeIds?.length)
				throw new Error('Modes are unavailable for this run.');
			const parsedSkillCommand = parseSkillCommand(request.message);
			const modelId = extension?.model ?? options.model ?? options.modelId;
			const effort = extension?.effort ?? options.effort;
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
				scope: {
					ownerId: `${request.category === 'main' ? 'interactive' : request.agentId}:${request.sessionId}`,
					source:
						request.category === 'main'
							? 'interactive'
							: request.category === 'task'
								? 'task'
								: request.category === 'health'
									? 'health'
									: 'child',
					sessionId: request.sessionId,
					runId: request.id,
				},
				agentId: request.agentId,
				toolProfile,
				contextMode:
					options.contextMode ??
					(options.lightContext === true || request.category !== 'main' ? 'minimal' : 'workspace'),
				...(extension ? { extension } : {}),
				...(effort ? { effort } : {}),
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
				...(parsedSkillCommand.unloadSkill ? { unloadSkill: parsedSkillCommand.unloadSkill } : {}),
				...(request.category === 'main' ? { followUps: () => record.followUps.splice(0) } : {}),
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

			init(
				session,
				this.config,
				options.reuseLastUserMessage ? { ...input, message: '' } : input,
				request.category,
				this.sessions
			);
			if (request.category === 'main') session.modeIds = extension?.ids ?? [];
			tryAppendRun(session, {
				type: 'run_queue_metrics',
				queueDelayMs: Date.now() - request.queuedAt,
			});

			const timeoutController = new AbortController();
			const startTimeout = (): void => {
				clearTimeout(timeoutTimer);
				timeoutTimer = setTimeout(
					() => timeoutController.abort(new DOMException('Run timed out.', 'TimeoutError')),
					10 * 60_000
				);
			};
			startTimeout();
			const runSignal = AbortSignal.any([
				controller.signal,
				timeoutController.signal,
				...(session.lease ? [session.lease.signal] : []),
			]);
			const events = stream(this.config, session, input, runSignal, {
				streaming: options.streaming ?? true,
				...(options.modelOptions ? { modelOptions: options.modelOptions } : {}),
				resources: this.resources,
				sandbox: this.sandbox,
				memory: this.memory,
				providerLimiter: this.providerLimiter,
				subagentLimiter: this.subagentLimiter,
			});

			const streamingToolArgs = new Map<string, { name: string; argsText: string }>();
			for await (const event of events) {
				if (event.type === 'user_input_request' || event.type === 'tool_permission_request')
					clearTimeout(timeoutTimer);
				else startTimeout();
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
			clearTimeout(timeoutTimer);
			if (session.id && request.category === 'main')
				await this.memory?.capture(session.id, session.messages).catch(() => undefined);
			releaseSession(session);
		}
	}

	private emit(record: AgentRunRecord<InternalAgentSendOptions>, event: AgentResponseEvent): void {
		const stamped = { ...event, seq: record.responseEvents.length };
		record.responseEvents.push(stamped);
		record.request.options.streamEvent?.(stamped);
		const waiting =
			event.type === 'tool_permission_request'
				? 'approval'
				: event.type === 'user_input_request'
					? 'question'
					: ['tool_call_result', 'user_input_result', 'run_finished'].includes(event.type)
						? undefined
						: record.waiting;
		if (waiting !== record.waiting) {
			record.waiting = waiting;
			this.onActivity?.();
		}
		if (event.type === 'tool_permission_request' || event.type === 'user_input_request')
			this.onRun?.({
				sessionId: record.request.sessionId,
				category: record.request.category,
				windowId: record.request.windowId,
				workspaceId: record.request.workspaceId,
				phase: 'waiting',
				reason: event.type === 'tool_permission_request' ? 'approval' : 'question',
			});
	}

	listActivity(): Record<string, { running: number; waiting: number }> {
		const activity: Record<string, { running: number; waiting: number }> = {};
		for (const record of this.runs.values()) {
			if (record.request.category !== 'main' && record.request.category !== 'task') continue;
			const entry = (activity[record.request.workspaceId] ??= { running: 0, waiting: 0 });
			if (record.waiting) entry.waiting += 1;
			else entry.running += 1;
		}
		return activity;
	}

	getSessionSnapshot(sessionId: string): AgentSessionSnapshot {
		const { id } = currentWorkspace();
		const active = [...this.runs.values()].find(
			(record) =>
				record.request.category === 'main' &&
				record.request.sessionId === sessionId &&
				record.request.workspaceId === id
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

	compactSession(sessionId: string): Promise<AgentCompactSessionResult> {
		const config = this.config;
		const resolvedSessionId = resolveStoredSessionId(
			sessionId,
			config.workspace.sessions,
			'main',
			config.workspace.id
		);
		if (sessionType(config.workspace.sessions, resolvedSessionId) !== 'main')
			return Promise.reject(new Error('Only main chat sessions can be compacted.'));
		return this.scheduler.run(
			resolvedSessionId,
			() => compactConversation(config, resolvedSessionId, this.providerLimiter),
			{ priority: 'high' }
		);
	}

	listSessions(category: SessionCategory | 'all' = 'main'): AgentSessionSummary[] {
		if (category === 'all') {
			return (['main', 'health', 'task', 'subagent', 'voice'] as const)
				.flatMap((sessionCategory) => this.listSessions(sessionCategory))
				.sort((left, right) => right.createdAtMs - left.createdAtMs);
		}
		const workspace = currentWorkspace();
		const sessions = listSessions(workspace.sessions, category, workspace.id);
		const byId = new Map(sessions.map((session) => [session.id, session]));
		for (const record of this.runs.values()) {
			if (record.request.category !== category || record.request.workspaceId !== workspace.id)
				continue;
			const stored = byId.get(record.request.sessionId);
			byId.set(record.request.sessionId, {
				id: record.request.sessionId,
				createdAtMs: stored?.createdAtMs ?? record.request.queuedAt,
				updatedAtMs: Math.max(stored?.updatedAtMs ?? 0, record.request.queuedAt),
				lastMessageAtMs: Math.max(stored?.lastMessageAtMs ?? 0, record.request.queuedAt),
				title: stored?.title ?? record.request.message.slice(0, 80),
				pinned: stored?.pinned,
				archived: stored?.archived,
				category,
				runStatus: record.lifecycle.status,
			});
		}
		return [...byId.values()].sort(
			(left, right) =>
				(right.lastMessageAtMs ?? right.createdAtMs) - (left.lastMessageAtMs ?? left.createdAtMs)
		);
	}

	renameSession(sessionId: string, title: string): Promise<void> {
		const root = currentWorkspace().sessions;
		return this.scheduler.run(
			sessionId,
			async () => renameStoredSession(sessionId, root, title),
			{ priority: 'high' }
		);
	}

	pinSession(sessionId: string, pinned: boolean): Promise<void> {
		const root = currentWorkspace().sessions;
		return this.scheduler.run(
			sessionId,
			async () => pinStoredSession(sessionId, root, pinned),
			{ priority: 'high' }
		);
	}

	moveSession(sessionId: string, workspaceId: string): Promise<void> {
		const workspace = currentWorkspace();
		const target = resolveWorkspace(workspaceId);
		if (sessionWorkspace(workspace.sessions, sessionId) !== workspace.id)
			return Promise.reject(new Error('Assistant session not found.'));
		return this.scheduler.run(
			sessionId,
			async () => moveStoredSession(sessionId, workspace.sessions, target.id),
			{ priority: 'high' }
		);
	}

	categorizeSession(sessionId: string, category: string | null): Promise<void> {
		const root = currentWorkspace().sessions;
		return this.scheduler.run(
			sessionId,
			async () => categorizeStoredSession(sessionId, root, category),
			{ priority: 'high' }
		);
	}

	archiveSession(sessionId: string, archived: boolean): Promise<void> {
		const root = currentWorkspace().sessions;
		return this.scheduler.run(
			sessionId,
			async () => archiveStoredSession(sessionId, root, archived),
			{ priority: 'high' }
		);
	}

	getLastMessages(sessionId: string): AgentHistoryMessage[] {
		return loadMessages(this.config, sessionId).flatMap(toHistoryMessages);
	}

	getPromptInputCapabilities(): AgentPromptInputCapabilities | null {
		return resolvePromptInputCapabilities(getProviderId(), getModelId());
	}

	editUserMessage(sessionId: string, userOffsetFromEnd: number, content?: string): Promise<boolean> {
		const config = this.config;
		const memory = this.memory;
		const resolvedSessionId = resolveStoredSessionId(
			sessionId,
			config.workspace.sessions,
			'main',
			config.workspace.id
		);
		return this.scheduler.run(
			resolvedSessionId,
			async () => {
				const updated = updateUserMessageBySessionId(
					resolvedSessionId,
					config.workspace.sessions,
					userOffsetFromEnd,
					content,
					this.sessions
				);
				if (updated)
					await memory
						?.capture(resolvedSessionId, loadMessages(config, resolvedSessionId))
						.catch(() => undefined);
				return updated;
			},
			{ priority: 'high' }
		);
	}

	clearMessages(sessionId: string): Promise<void> {
		const config = this.config;
		const memory = this.memory;
		const resolvedSessionId = resolveStoredSessionId(
			sessionId,
			config.workspace.sessions,
			'main',
			config.workspace.id
		);
		const completions = this.cancelSession(resolvedSessionId);
		return this.scheduler.run(
			resolvedSessionId,
			async () => {
				await Promise.allSettled(completions);
				clearSessionMessages(createSessionState(), config, resolvedSessionId, this.sessions);
				this.histories.delete(resolvedSessionId);
				await memory?.remove(resolvedSessionId).catch(() => undefined);
			},
			{ priority: 'high' }
		);
	}

	deleteSession(sessionId: string): Promise<void> {
		const config = this.config;
		const memory = this.memory;
		const resolvedSessionId = resolveStoredSessionId(
			sessionId,
			config.workspace.sessions,
			'main',
			config.workspace.id
		);
		const completions = this.cancelSession(resolvedSessionId);
		registry.terminate(resolvedSessionId);
		return this.scheduler.run(
			resolvedSessionId,
			async () => {
				await Promise.allSettled(completions);
				deleteStoredSession(createSessionState(), config, resolvedSessionId, this.sessions);
				this.histories.delete(resolvedSessionId);
				await memory?.remove(resolvedSessionId).catch(() => undefined);
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

	followUp(runId: string, followUp: AgentFollowUp, windowId?: number): boolean {
		const record = this.runs.get(runId);
		if (!record || (windowId !== undefined && record.request.windowId !== windowId)) return false;
		if (record.request.category !== 'main' || record.lifecycle.status === 'cancelling')
			return false;
		record.followUps.push(followUp);
		return true;
	}

	cancelFollowUp(runId: string, id: string, windowId?: number): boolean {
		const record = this.runs.get(runId);
		if (!record || (windowId !== undefined && record.request.windowId !== windowId)) return false;
		const index = record.followUps.findIndex((followUp) => followUp.id === id);
		if (index < 0) return false;
		record.followUps.splice(index, 1);
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

function runtimeEventToAgentEvents(
	event: RuntimeEvent,
	agentId: string,
	runId: string,
	streamingToolArgs: Map<string, { name: string; argsText: string }>
): AgentResponseEvent[] {
	if (event.type === 'history_compacted') return [{ ...event, agentId, runId }];
	if (event.type === 'run_started') {
		return [
			{
				type: 'run_started',
				sessionId: event.sessionId,
				modeIds: event.modeIds,
				skillIds: (event.skillActivations ?? []).map((skill) => skill.id),
				agentId,
				runId,
			},
			{ type: 'run_state', state: 'thinking', agentId, runId },
		];
	}
	if (event.type === 'run_error') {
		return [{ type: 'run_state', state: 'error', label: event.message, agentId, runId }];
	}
	if (event.type === 'follow_up') {
		return [
			{ type: 'follow_up', id: event.id, text: event.text, agentId, runId },
			{ type: 'run_state', state: 'thinking', agentId, runId },
		];
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
	if (event.type === 'run_budget_warning') return [{ ...event, agentId, runId }];
	if (event.type === 'context_usage') return [{ ...event, agentId, runId }];
	if (event.type === 'model_call_end') {
		return [{ type: 'model_usage', usage: event.usage, agentId, runId }];
	}
	if (event.type === 'capability_resolution_start') {
		return [{ type: 'capability_resolution_start', agentId, runId }];
	}
	if (event.type === 'capability_resolution_result') {
		return [
			{
				type: 'capability_resolution_result',
				tools: event.tools.map((tool) => tool.id),
				services: event.tools.map((tool) => ({
					name: tool.name,
					displayName: tool.name,
					serviceKind: 'tool' as const,
				})),
				skills: [],
				directAnswer: false,
				decision: { mode: 'use_tools', reason: 'Tools selected for this run.' },
				agentId,
				runId,
			},
		];
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
