import WebSocket from 'ws';
import { REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH } from '../../../../shared/realtime_voice';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceAdapterEventHandler,
	RealtimeVoiceAdapterRequest,
	RealtimeVoiceConnection,
	RealtimeVoiceProviderSpec,
} from './realtime_voice_types';

const LIVE_URL = 'wss://api.openai.com/v1/live/sessions';
const CONNECT_TIMEOUT_MS = 15_000;

interface LiveSocket {
	readonly bufferedAmount: number;
	on(
		event: 'open' | 'close' | 'error' | 'message',
		listener: (...args: unknown[]) => void
	): unknown;
	send(data: string): void;
	close(code?: number, reason?: string): void;
}

type LiveSocketFactory = (provider: RealtimeVoiceProviderSpec) => LiveSocket;

export class OpenAILiveVoiceAdapter implements RealtimeVoiceAdapter {
	constructor(
		private readonly provider: RealtimeVoiceProviderSpec,
		private readonly socketFactory: LiveSocketFactory = createLiveSocket,
		private readonly connectTimeoutMs = CONNECT_TIMEOUT_MS
	) {}

	async connect(
		request: RealtimeVoiceAdapterRequest,
		emit: RealtimeVoiceAdapterEventHandler,
		signal?: AbortSignal
	): Promise<RealtimeVoiceConnection> {
		if (request.modelId !== 'gpt-live-1') {
			throw new Error(
				`${this.provider.name} Live voice model is not supported: ${request.modelId}`
			);
		}
		const connection = new OpenAILiveVoiceConnection(this.socketFactory(this.provider), emit);
		await connection.open(request, this.connectTimeoutMs, signal);
		return connection;
	}
}

class OpenAILiveVoiceConnection implements RealtimeVoiceConnection {
	private closed = false;
	private inputTranscript = '';
	private inputTurn = 0;
	private inputTurnActive = false;
	private outputTranscript = '';
	private outputTurn = 0;

	constructor(
		private readonly socket: LiveSocket,
		private readonly emit: RealtimeVoiceAdapterEventHandler
	) {}

	open(
		request: RealtimeVoiceAdapterRequest,
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
				settle(
					signal?.reason instanceof Error ? signal.reason : new Error('Voice session stopped.')
				);
				void this.stop();
			};
			const timer = setTimeout(() => {
				settle(new Error('Live voice connection timed out.'));
				void this.stop();
			}, timeoutMs);
			timer.unref?.();

			this.socket.on('open', () => {
				this.send({
					type: 'session.start',
					session: {
						model: request.modelId,
						instructions: request.instructions,
						audio: {
							format: { type: 'audio/pcm', rate: 24_000 },
							output: { voice: request.voice.trim() || 'marin' },
						},
						delegation: { type: 'client' },
					},
				});
			});
			this.socket.on('message', (data) => {
				const event = parseLiveEvent(data);
				if (!event) return;
				if (event.type === 'session.started') settle();
				this.handle(event);
			});
			this.socket.on('error', (error) => {
				const message = error instanceof Error ? error.message : 'Live voice connection failed.';
				if (!settled) settle(new Error(message));
				else this.emit({ type: 'error', message });
			});
			this.socket.on('close', () => {
				this.closed = true;
				if (!settled) settle(new Error('Live voice connection closed before setup.'));
				this.finishInputTurn();
				this.finishOutputTurn();
				this.emit({ type: 'closed' });
			});
			signal?.addEventListener('abort', abort, { once: true });
			if (signal?.aborted) abort();
		});
	}

	async appendAudio(audio: string): Promise<void> {
		if (this.closed) throw new Error('Live voice connection is closed.');
		if (this.socket.bufferedAmount + audio.length > REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH) {
			throw new Error('Live voice transport queue is full.');
		}
		this.send({ type: 'session.input_audio.append', audio });
	}

	async interrupt(): Promise<void> {}

	async addToolResult(): Promise<void> {}

	async stop(): Promise<void> {
		if (this.closed) return;
		this.closed = true;
		this.socket.close(1000, 'Voice session stopped.');
	}

	private send(event: Record<string, unknown>): void {
		this.socket.send(JSON.stringify(event));
	}

	private inputItemId(): string {
		return `live-input-${this.inputTurn}`;
	}

	private outputItemId(): string {
		return `live-output-${this.outputTurn}`;
	}

	private finishInputTurn(): void {
		if (!this.inputTurnActive) return;
		const itemId = this.inputItemId();
		this.emit({ type: 'input_speech_stopped', itemId });
		const transcript = this.inputTranscript.trim();
		if (transcript) this.emit({ type: 'user_transcript_final', itemId, transcript });
		this.inputTranscript = '';
		this.inputTurnActive = false;
		this.inputTurn += 1;
	}

	private finishOutputTurn(): void {
		const transcript = this.outputTranscript.trim();
		if (transcript) {
			const itemId = this.outputItemId();
			this.emit({
				type: 'assistant_transcript_final',
				itemId,
				responseId: itemId,
				transcript,
			});
		}
		this.outputTranscript = '';
		this.outputTurn += 1;
	}

	private handle(event: Record<string, unknown>): void {
		if (event.type === 'session.input_transcript.delta' && typeof event.delta === 'string') {
			if (!this.inputTurnActive) {
				this.inputTurnActive = true;
				this.emit({ type: 'input_speech_started', itemId: this.inputItemId() });
			}
			this.inputTranscript += event.delta;
			return;
		}
		if (event.type === 'session.output_audio.delta' && typeof event.delta === 'string') {
			this.finishInputTurn();
			const itemId = this.outputItemId();
			this.emit({
				type: 'assistant_audio_delta',
				itemId,
				responseId: itemId,
				audio: event.delta,
			});
			return;
		}
		if (event.type === 'session.output_audio.done') {
			this.finishInputTurn();
			const itemId = this.outputItemId();
			this.finishOutputTurn();
			this.emit({
				type: 'assistant_audio_done',
				itemId,
				responseId: itemId,
			});
			return;
		}
		if (event.type === 'session.output_transcript.delta' && typeof event.delta === 'string') {
			this.finishInputTurn();
			const itemId = this.outputItemId();
			this.outputTranscript += event.delta;
			this.emit({
				type: 'assistant_transcript_delta',
				itemId,
				responseId: itemId,
				delta: event.delta,
			});
			return;
		}
	}
}

function createLiveSocket(provider: RealtimeVoiceProviderSpec): LiveSocket {
	return new WebSocket(LIVE_URL, { headers: { Authorization: `Bearer ${provider.apiKey}` } });
}

function parseLiveEvent(data: unknown): Record<string, unknown> | undefined {
	try {
		const text = Buffer.isBuffer(data) ? data.toString() : String(data);
		const parsed: unknown = JSON.parse(text);
		return typeof parsed === 'object' && parsed !== null
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}
