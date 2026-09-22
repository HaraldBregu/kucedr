import type { RealtimeVoiceEvent, RealtimeVoiceToolEvent } from '../../../shared/realtime_voice';
import { createRunContext } from '../context';
import type { KeyedMutex } from '../mutex';
import { formatToolOutput } from '../runner/run_common';
import { runToolCall } from '../runner/run_tool_call';
import type { Tool, ToolCall } from '../types';
import type {
	RealtimeVoiceAdapterEvent,
	RealtimeVoiceConnection,
} from '../../models/adapters/realtime_voice';
import { rejectPendingToolPermissions } from '../permissions';
import { parseToolArgs } from '../../shared/parse_tool_args';
import type { RealtimeVoiceConversation } from './conversation';

const MAX_TOOL_CALLS = 100;
const MAX_TOOL_OUTPUT_BYTES = 2_000_000;
const MAX_PAID_TOOL_CALLS = 3;
const MAX_WEB_TOOL_CALLS = 8;
const PAID_TOOLS = new Set(['create_image', 'create_video', 'create_sound']);
const WEB_TOOLS = new Set(['search_web', 'fetch_web_page', 'use_web_browser']);

type ToolAdapterEvent = Extract<
	RealtimeVoiceAdapterEvent,
	{ type: 'tool_call_start' | 'tool_call_args_delta' | 'tool_call' }
>;

type RealtimeVoiceToolPayload = RealtimeVoiceToolEvent extends infer Event
	? Event extends RealtimeVoiceToolEvent
		? Omit<Event, 'sessionId' | 'agentId' | 'runId'>
		: never
	: never;

export interface RealtimeVoiceToolRuntimeDependencies {
	sessionId: string;
	chatSessionId?: string;
	windowId: number;
	tools: Tool[];
	signal: AbortSignal;
	resources: KeyedMutex;
	conversation: Pick<RealtimeVoiceConversation, 'addToolCall' | 'addToolResult'>;
	connection(): RealtimeVoiceConnection | undefined;
	emit(event: RealtimeVoiceEvent): void;
	onThinking(): void;
	onError(error: unknown): void;
}

export class RealtimeVoiceToolRuntime {
	private readonly responses = new Map<
		string,
		{ controller: AbortController; signal: AbortSignal; runId: string }
	>();
	private readonly fileAccess = createRunContext().fileAccess;
	private readonly names = new Map<string, string>();
	private readonly arguments = new Map<string, string>();
	private readonly pending = new Set<string>();
	private readonly completed = new Set<string>();
	private tail = Promise.resolve();
	private calls = 0;
	private outputBytes = 0;
	private paidCalls = 0;
	private webCalls = 0;

	constructor(private readonly dependencies: RealtimeVoiceToolRuntimeDependencies) {}

	observe(responseId: string): boolean {
		if (!this.responses.has(responseId)) {
			const controller = new AbortController();
			this.responses.set(responseId, {
				controller,
				signal: AbortSignal.any([this.dependencies.signal, controller.signal]),
				runId: `${this.dependencies.sessionId}:${responseId}`,
			});
		}
		return !this.responses.get(responseId)!.signal.aborted;
	}

	interrupt(): void {
		for (const response of this.responses.values()) {
			response.controller.abort(new DOMException('Voice response interrupted.', 'AbortError'));
			rejectPendingToolPermissions(response.runId);
		}
	}

	handle(event: ToolAdapterEvent): void {
		this.observe(event.responseId);
		const response = this.responses.get(event.responseId)!;
		if (response.signal.aborted && event.type !== 'tool_call') return;
		if (event.type === 'tool_call_start') {
			if (this.names.has(event.callId)) return;
			this.names.set(event.callId, event.name);
			this.arguments.set(event.callId, '');
			this.emit(
				{
					type: 'tool_call_start',
					iteration: 0,
					toolCallId: event.callId,
					toolName: event.name,
					name: event.name,
					serviceKind: 'tool',
				},
				response.runId
			);
			return;
		}
		if (event.type === 'tool_call_args_delta') {
			const name = this.names.get(event.callId) ?? 'tool';
			const argsText = `${this.arguments.get(event.callId) ?? ''}${event.delta}`;
			this.arguments.set(event.callId, argsText);
			this.emit(
				{
					type: 'tool_call_args_delta',
					iteration: 0,
					toolCallId: event.callId,
					toolName: name,
					jsonDelta: event.delta,
					argsText,
				},
				response.runId
			);
			return;
		}
		if (this.pending.has(event.callId) || this.completed.has(event.callId)) return;
		this.pending.add(event.callId);
		this.tail = this.tail.then(() => this.run(event)).catch(this.dependencies.onError);
	}

	private async run(event: Extract<ToolAdapterEvent, { type: 'tool_call' }>): Promise<void> {
		const response = this.responses.get(event.responseId)!;
		try {
			const tool = this.dependencies.tools.find((candidate) => candidate.id === event.name);
			const args = parseToolArgs(event.arguments);
			if (!this.names.has(event.callId)) {
				this.names.set(event.callId, event.name);
				this.emit(
					{
						type: 'tool_call_start',
						iteration: 0,
						toolCallId: event.callId,
						toolName: event.name,
						name: event.name,
						serviceKind: 'tool',
					},
					response.runId
				);
			}
			this.emit(
				{
					type: 'tool_call_input',
					iteration: 0,
					toolCallId: event.callId,
					toolName: event.name,
					input: args,
					argsText: event.arguments,
					name: event.name,
					serviceKind: 'tool',
				},
				response.runId
			);
			if (!response.signal.aborted) this.dependencies.onThinking();
			const persistedToolCall: ToolCall = { id: event.callId, name: event.name, args };
			this.dependencies.conversation.addToolCall(persistedToolCall);

			const budgetError = response.signal.aborted
				? 'Error: voice response interrupted before this action completed.'
				: this.consumeBudget(event.name);
			if (budgetError) {
				await this.finish(persistedToolCall, args, budgetError, true, 0, response);
				return;
			}

			const toolCall: ToolCall = { ...persistedToolCall };
			for await (const runtimeEvent of runToolCall(
				tool,
				toolCall,
				response.signal,
				this.fileAccess,
				{
					runId: response.runId,
					windowId: this.dependencies.windowId,
					...(this.dependencies.chatSessionId
						? {
								scope: {
									ownerId: `interactive:${this.dependencies.chatSessionId}`,
									source: 'interactive' as const,
									sessionId: this.dependencies.chatSessionId,
									runId: response.runId,
								},
							}
						: {}),
				},
				this.dependencies.resources
			)) {
				if (runtimeEvent.type === 'tool_permission_request')
					this.emit(runtimeEvent, response.runId);
				if (runtimeEvent.type === 'tool_call_end') {
					await this.finish(
						persistedToolCall,
						runtimeEvent.input,
						runtimeEvent.output,
						runtimeEvent.isError === true,
						runtimeEvent.durationMs,
						response
					);
				}
			}
		} catch (error) {
			if (!response.signal.aborted) throw error;
			if (this.completed.has(event.callId)) return;
			const call: ToolCall = {
				id: event.callId,
				name: event.name,
				args: parseToolArgs(event.arguments),
			};
			await this.finish(
				call,
				call.args,
				'Error: voice response interrupted; the action may have started.',
				true,
				0,
				response
			);
		} finally {
			this.pending.delete(event.callId);
			this.arguments.delete(event.callId);
		}
	}

	private consumeBudget(name: string): string | undefined {
		if (this.outputBytes > MAX_TOOL_OUTPUT_BYTES)
			return 'Error: realtime voice tool-output budget exhausted.';
		this.calls += 1;
		if (this.calls > MAX_TOOL_CALLS) return 'Error: realtime voice tool-call budget exhausted.';
		if (PAID_TOOLS.has(name)) {
			this.paidCalls += 1;
			if (this.paidCalls > MAX_PAID_TOOL_CALLS) return 'Error: paid tool-call budget exhausted.';
		}
		if (WEB_TOOLS.has(name)) {
			this.webCalls += 1;
			if (this.webCalls > MAX_WEB_TOOL_CALLS) return 'Error: web tool-call budget exhausted.';
		}
		return undefined;
	}

	private async finish(
		toolCall: ToolCall,
		input: Record<string, unknown>,
		output: unknown,
		isError: boolean,
		durationMs: number,
		response: { signal: AbortSignal; runId: string }
	): Promise<void> {
		const outputText = formatToolOutput(output);
		this.outputBytes += Buffer.byteLength(outputText, 'utf8');
		const exhausted = this.outputBytes > MAX_TOOL_OUTPUT_BYTES;
		const finalOutput = exhausted
			? 'Error: realtime voice tool-output budget exhausted.'
			: outputText;
		const finalError = isError || exhausted;
		toolCall.args = input;
		toolCall.result = {
			content: finalOutput,
			...(finalError ? { isError: true } : {}),
		};
		this.dependencies.conversation.addToolResult(toolCall);
		this.completed.add(toolCall.id);
		this.emit(
			{
				type: 'tool_call_result',
				iteration: 0,
				toolCallId: toolCall.id,
				toolName: toolCall.name,
				input,
				output: finalOutput,
				outputText: finalOutput,
				status: finalError ? 'error' : 'ok',
				durationMs,
				...(finalError ? { errorText: finalOutput } : {}),
				name: toolCall.name,
				serviceKind: 'tool',
			},
			response.runId
		);
		if (!response.signal.aborted) {
			await this.dependencies.connection()?.addToolResult(toolCall.id, finalOutput);
		}
	}

	private emit(event: RealtimeVoiceToolPayload, runId: string): void {
		this.dependencies.emit({
			...event,
			sessionId: this.dependencies.sessionId,
			agentId: 'main',
			runId,
		} as RealtimeVoiceEvent);
	}
}
