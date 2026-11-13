import { realtimeVoiceCloseError } from './close';
import { realtimeVoiceResponseError } from './response';
import { realtimeVoiceTransportError } from './transport';
import { REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH } from '../../../../shared/realtime_voice';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceAdapterEventHandler,
	RealtimeVoiceAdapterRequest,
	RealtimeVoiceConnection,
	RealtimeVoiceHistoryMessage,
	RealtimeVoiceModelSpec,
	RealtimeVoiceProviderSpec,
	RealtimeVoiceServerEvent,
	RealtimeVoiceSocket,
	RealtimeVoiceSocketFactory,
} from './realtime_voice_types';

const CONNECT_TIMEOUT_MS = 15_000;

export interface CompatibleRealtimeVoiceProfile {
	readonly provider: RealtimeVoiceProviderSpec;
	readonly model: RealtimeVoiceModelSpec;
	readonly serverInterrupts: boolean;
	readonly socketFactory: RealtimeVoiceSocketFactory;
	session(request: RealtimeVoiceAdapterRequest): Record<string, unknown>;
}

export class CompatibleRealtimeVoiceAdapter implements RealtimeVoiceAdapter {
	constructor(
		private readonly profile: CompatibleRealtimeVoiceProfile,
		private readonly connectTimeoutMs = CONNECT_TIMEOUT_MS
	) {}

	async connect(
		request: RealtimeVoiceAdapterRequest,
		emit: RealtimeVoiceAdapterEventHandler,
		signal?: AbortSignal
	): Promise<RealtimeVoiceConnection> {
		signal?.throwIfAborted();
		const socket = this.profile.socketFactory(this.profile.provider, this.profile.model);
		const connection = new CompatibleRealtimeVoiceConnection(
			socket,
			emit,
			this.profile.serverInterrupts,
			(error) => realtimeVoiceTransportError(error, this.profile.provider, request.modelId)
		);
		await connection.open(
			this.profile.session({
				...request,
				voice: realtimeVoiceName(request.voice, this.profile.model),
			}),
			request.history,
			this.connectTimeoutMs,
			signal
		);
		return connection;
	}
}

class CompatibleRealtimeVoiceConnection implements RealtimeVoiceConnection {
	private closed = false;
	private responseActive = false;
	private responsePending = false;
	private responseQueued = false;
	private userSpeaking = false;
	private activeResponseId?: string;
	private readonly responseTools = new Map<
		string,
		{ callIds: Set<string>; resultIds: Set<string>; responseDone: boolean; continued: boolean }
	>();
	private readonly callResponses = new Map<string, string>();

	constructor(
		private readonly realtime: RealtimeVoiceSocket,
		private readonly emit: RealtimeVoiceAdapterEventHandler,
		private readonly serverInterrupts: boolean,
		private readonly transportError: (error: Error) => Error
	) {}

	open(
		session: Record<string, unknown>,
		history: readonly RealtimeVoiceHistoryMessage[],
		timeoutMs: number,
		signal?: AbortSignal
	): Promise<void> {
		return new Promise((resolve, reject) => {
			let settled = false;
			const settle = (error?: Error): void => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				signal?.removeEventListener('abort', abort);
				if (error) reject(error);
				else resolve();
			};
			const abort = (): void => {
				const reason = signal?.reason;
				const message =
					typeof reason === 'object' &&
					reason !== null &&
					'message' in reason &&
					typeof reason.message === 'string'
						? reason.message
						: 'Voice session stopped.';
				settle(reason instanceof Error ? reason : new Error(message));
				void this.stop();
			};
			const timer = setTimeout(() => {
				settle(new Error('Realtime voice connection timed out.'));
				void this.stop();
			}, timeoutMs);
			timer.unref?.();

			this.realtime.on('event', (event) => {
				if (this.closed) return;
				if (event.type === 'error') {
					const error = new Error(event.error.message);
					if (!settled) {
						settle(error);
						void this.stop();
						return;
					}
				}
				if (event.type === 'session.updated') {
					if (!settled) {
						this.replayHistory(history);
						settle();
					}
				}
				this.handleEvent(event);
			});
			this.realtime.on('error', (error) => {
				if (this.closed || ('error' in error && error.error)) return;
				const failure = this.transportError(error);
				if (!settled) {
					settle(failure);
					void this.stop();
				} else this.emit({ type: 'error', message: failure.message });
			});
			this.realtime.socket.on('close', (code, reason) => {
				const stopped = this.closed;
				this.closed = true;
				const error = stopped
					? null
					: realtimeVoiceCloseError(code, reason, 'Realtime voice connection closed');
				if (!settled) {
					settle(error ?? new Error('Realtime voice connection closed before setup.'));
					return;
				}
				if (error) this.emit({ type: 'error', message: error.message });
				else this.emit({ type: 'closed' });
			});
			this.realtime.socket.on('open', () => {
				if (this.closed) return;
				this.realtime.send({ type: 'session.update', session });
			});
			signal?.addEventListener('abort', abort, { once: true });
			if (signal?.aborted) abort();
		});
	}

	private replayHistory(history: readonly RealtimeVoiceHistoryMessage[]): void {
		for (const message of history) {
			this.realtime.send({
				type: 'conversation.item.create',
				item:
					message.role === 'user'
						? {
								type: 'message',
								role: 'user',
								content: [{ type: 'input_text', text: message.text }],
							}
						: {
								type: 'message',
								role: 'assistant',
								content: [{ type: 'output_text', text: message.text }],
							},
			});
		}
	}

	async appendAudio(audio: string): Promise<void> {
		if (this.closed) throw new Error('Realtime voice connection is closed.');
		if (
			this.realtime.socket.bufferedAmount + audio.length >
			REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH
		) {
			throw new Error('Realtime voice transport queue is full.');
		}
		this.realtime.send({ type: 'input_audio_buffer.append', audio });
	}

	async interrupt(): Promise<void> {
		this.responseQueued = false;
		if (this.closed || !this.responseActive) return;
		this.responseActive = false;
		this.realtime.send({ type: 'response.cancel' });
	}

	async addToolResult(callId: string, output: string): Promise<void> {
		if (this.closed) return;
		this.realtime.send({
			type: 'conversation.item.create',
			item: { type: 'function_call_output', call_id: callId, output },
		});
		const responseId = this.callResponses.get(callId);
		const tools = responseId ? this.responseTools.get(responseId) : undefined;
		if (!responseId || !tools) {
			this.createResponse();
			return;
		}
		tools.resultIds.add(callId);
		this.continueToolResponse(responseId, tools);
	}

	async stop(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		this.realtime.close({ code: 1000, reason: 'Voice session stopped.' });
	}

	private createResponse(): void {
		if (this.responsePending || this.activeResponseId) {
			this.responseQueued = true;
			return;
		}
		this.responsePending = true;
		this.realtime.send({ type: 'response.create' });
	}

	private handleEvent(event: RealtimeVoiceServerEvent): void {
		if (event.type === 'response.created') {
			const overlapsSpeech = this.responsePending && this.userSpeaking;
			this.responsePending = false;
			this.responseActive = true;
			this.activeResponseId = event.response.id;
			if (overlapsSpeech) void this.interrupt();
			else this.emit({ type: 'response_started', responseId: event.response.id });
			return;
		}
		if (event.type === 'response.done') {
			this.responseActive = false;
			const responseId = event.response?.id ?? this.activeResponseId;
			this.activeResponseId = undefined;
			const responseError = event.response
				? realtimeVoiceResponseError(event.response)
				: null;
			if (responseError) {
				this.emit({ type: 'error', message: responseError });
				return;
			}
			const tools = responseId ? this.responseTools.get(responseId) : undefined;
			if (responseId && tools) {
				tools.responseDone = true;
				this.continueToolResponse(responseId, tools);
			}
			if (responseId && !tools) this.emit({ type: 'response_done', responseId });
			if (this.responseQueued) {
				this.responseQueued = false;
				if (!this.responsePending) this.createResponse();
			}
			return;
		}
		if (
			event.type === 'response.output_item.added' &&
			event.item.type === 'function_call' &&
			event.item.call_id &&
			event.item.name
		) {
			this.registerToolCall(event.response_id, event.item.call_id);
			this.emit({
				type: 'tool_call_start',
				callId: event.item.call_id,
				itemId: event.item.id ?? '',
				responseId: event.response_id,
				name: event.item.name,
			});
			return;
		}
		if (event.type === 'input_audio_buffer.speech_started') {
			if (this.serverInterrupts) this.responseActive = false;
			this.responseQueued = false;
			this.userSpeaking = true;
			this.emit({ type: 'input_speech_started', itemId: event.item_id });
			return;
		}
		if (event.type === 'input_audio_buffer.speech_stopped') {
			this.userSpeaking = false;
			this.emit({ type: 'input_speech_stopped', itemId: event.item_id });
			return;
		}
		if (event.type === 'response.output_audio_transcript.delta') {
			this.emit({
				type: 'assistant_transcript_delta',
				itemId: event.item_id,
				responseId: event.response_id,
				delta: event.delta,
			});
			return;
		}
		if (event.type === 'response.output_audio_transcript.done') {
			this.emit({
				type: 'assistant_transcript_final',
				itemId: event.item_id,
				responseId: event.response_id,
				transcript: event.transcript,
			});
			return;
		}
		if (event.type === 'response.output_audio.delta') {
			this.emit({
				type: 'assistant_audio_delta',
				itemId: event.item_id,
				responseId: event.response_id,
				audio: event.delta,
			});
			return;
		}
		if (event.type === 'response.output_audio.done') {
			this.emit({
				type: 'assistant_audio_done',
				itemId: event.item_id,
				responseId: event.response_id,
			});
			return;
		}
		if (event.type === 'response.function_call_arguments.delta') {
			this.emit({
				type: 'tool_call_args_delta',
				callId: event.call_id,
				itemId: event.item_id,
				responseId: event.response_id,
				delta: event.delta,
			});
			return;
		}
		if (event.type === 'response.function_call_arguments.done') {
			this.registerToolCall(event.response_id, event.call_id);
			this.emit({
				type: 'tool_call',
				callId: event.call_id,
				itemId: event.item_id,
				responseId: event.response_id,
				name: event.name,
				arguments: event.arguments,
			});
			return;
		}
		if (event.type === 'error') {
			if (event.error.code === 'response_cancel_not_active') return;
			if (event.error.code === 'conversation_already_has_active_response') {
				this.responsePending = false;
				this.responseQueued = true;
				return;
			}
			this.emit({ type: 'error', message: event.error.message });
		}
	}

	private registerToolCall(responseId: string, callId: string): void {
		const tools = this.responseTools.get(responseId) ?? {
			callIds: new Set<string>(),
			resultIds: new Set<string>(),
			responseDone: false,
			continued: false,
		};
		tools.callIds.add(callId);
		this.responseTools.set(responseId, tools);
		this.callResponses.set(callId, responseId);
	}

	private continueToolResponse(
		responseId: string,
		tools: {
			callIds: Set<string>;
			resultIds: Set<string>;
			responseDone: boolean;
			continued: boolean;
		}
	): void {
		if (
			tools.continued ||
			!tools.responseDone ||
			tools.callIds.size === 0 ||
			tools.resultIds.size !== tools.callIds.size
		)
			return;
		tools.continued = true;
		this.createResponse();
		this.responseTools.delete(responseId);
		for (const callId of tools.callIds) this.callResponses.delete(callId);
	}
}
