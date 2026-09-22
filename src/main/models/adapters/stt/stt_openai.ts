import { speechToTextBaseUrl, realtimeSpeechToTextModelId } from '../../../models';
import OpenAI from 'openai';
import WebSocket from 'ws';
import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderUnsupportedError } from './stt_errors';
import type {
	SttAdapter,
	SttAdapterRealtimeStartRequest,
	SttAdapterTranscriptionRequest,
	SttProviderSpec,
	SttRealtimeConnection,
	SttRealtimeEventHandler,
} from './stt_types';
import type { SttTranscriptionResult, SttUsage } from '../../../../shared/stt_transcription';

const OPENAI_REALTIME_PATH = 'realtime';
const OPENAI_REALTIME_AUTH_SCHEME = 'Bearer';
const OPENAI_REALTIME_SESSION_UPDATE_EVENT = 'transcription_session.update';
const OPENAI_REALTIME_AUDIO_FORMAT = 'pcm16';

export interface OpenAISttAdapterOptions extends SttProviderSpec {
	clientFactory?: (opts: { apiKey: string; baseURL?: string }) => OpenAI;
}

type OpenAIRealtimeServerEvent = {
	type?: string;
	item_id?: string;
	content_index?: number;
	delta?: string;
	transcript?: string;
	error?: { message?: string };
};

export function createOpenAISttAdapter(opts: OpenAISttAdapterOptions): SttAdapter {
	if (!opts.apiKey) throw new SttProviderAuthError(`${opts.name} API key not configured.`);
	const provider = opts;
	const factory =
		opts.clientFactory ?? ((c) => new OpenAI({ apiKey: c.apiKey, baseURL: c.baseURL }));
	const client = factory({ apiKey: opts.apiKey, baseURL: opts.baseURL });

	return {
		async transcribe(request: SttAdapterTranscriptionRequest): Promise<SttTranscriptionResult> {
			try {
				const file = await createAudioFile(request.audio);
				const response = await client.audio.transcriptions.create(
					{
						file,
						model: request.modelId,
						language: request.language,
						prompt: request.prompt,
						temperature: request.temperature,
					},
					{ signal: request.signal }
				);
				const text = typeof response === 'string' ? response : response.text;
				const usage = typeof response === 'string' ? undefined : toUsage(response.usage);

				return {
					text,
					metadata: {
						providerId: provider.id,
						providerName: provider.name,
						modelId: request.modelId,
						...(request.language ? { language: request.language } : {}),
						createdAt: new Date().toISOString(),
						...(usage ? { usage } : {}),
					},
				};
			} catch (error) {
				const status = (error as { status?: number }).status ?? 0;
				const message = (error as Error).message ?? String(error);
				if (status === 401 || status === 403) throw new SttProviderAuthError(message);
				throw error;
			}
		},

		async startRealtime(
			request: SttAdapterRealtimeStartRequest,
			emit: SttRealtimeEventHandler
		): Promise<SttRealtimeConnection> {
			if (provider.id !== 'openai') {
				throw new SttProviderUnsupportedError(
					`${provider.name} realtime speech-to-text is not implemented.`
				);
			}

			const socket = new WebSocket(openAIRealtimeUrl(provider.baseURL), {
				headers: {
					Authorization: `${OPENAI_REALTIME_AUTH_SCHEME} ${provider.apiKey}`,
				},
			});
			await waitForOpen(socket);
			return createOpenAIRealtimeConnection(socket, request, emit);
		},
	};
}

function createOpenAIRealtimeConnection(
	socket: WebSocket,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): SttRealtimeConnection {
	let closed = false;

	const emitEvent = (event: Parameters<SttRealtimeEventHandler>[0]): void => {
		if (!closed) emit(event);
	};

	const emitError = (message: string): void => {
		emitEvent({ type: 'error', sessionId: request.sessionId, message });
	};

	const emitClosed = (): void => {
		if (closed) return;
		closed = true;
		emit({ type: 'closed', sessionId: request.sessionId });
	};

	const handleEvent = (message: string): void => {
		let event: OpenAIRealtimeServerEvent;
		try {
			event = JSON.parse(message) as OpenAIRealtimeServerEvent;
		} catch {
			return;
		}

		if (event.type === 'input_audio_buffer.committed') {
			emit({
				type: 'committed',
				sessionId: request.sessionId,
				itemId: event.item_id ?? request.sessionId,
			});
			return;
		}
		if (event.type === 'conversation.item.input_audio_transcription.delta') {
			emit({
				type: 'delta',
				sessionId: request.sessionId,
				itemId: event.item_id ?? request.sessionId,
				contentIndex: event.content_index ?? 0,
				delta: event.delta ?? '',
			});
			return;
		}
		if (event.type === 'conversation.item.input_audio_transcription.completed') {
			emit({
				type: 'completed',
				sessionId: request.sessionId,
				itemId: event.item_id ?? request.sessionId,
				contentIndex: event.content_index ?? 0,
				transcript: event.transcript ?? '',
			});
			socket.close(1000, 'completed');
			return;
		}
		if (event.type === 'conversation.item.input_audio_transcription.failed') {
			emitError(event.error?.message ?? 'OpenAI realtime transcription failed.');
			socket.close(1011, 'transcription failed');
			return;
		}
		if (event.type === 'error') {
			emitError(event.error?.message ?? 'OpenAI realtime transcription error.');
		}
	};

	socket.on('message', (data) => handleEvent(data.toString()));
	socket.once('error', (error) => emitError(error.message));
	socket.once('close', () => emitClosed());

	socket.send(
		JSON.stringify({
			type: OPENAI_REALTIME_SESSION_UPDATE_EVENT,
			session: {
				input_audio_format: OPENAI_REALTIME_AUDIO_FORMAT,
				input_audio_transcription: {
					model: request.modelId,
					...(request.language ? { language: request.language } : {}),
					...(request.prompt ? { prompt: request.prompt } : {}),
				},
				turn_detection: null,
			},
		})
	);

	return {
		async appendAudio(audio: string): Promise<void> {
			socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }));
		},

		async finish(): Promise<void> {
			socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
		},

		async cancel(): Promise<void> {
			socket.close(1000, 'cancelled');
			emitClosed();
		},
	};
}

function openAIRealtimeUrl(baseURL: string | undefined): string {
	const url = new URL(
		OPENAI_REALTIME_PATH,
		`${baseURL ?? speechToTextBaseUrl('openai')}/`
	);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	url.searchParams.set('model', realtimeSpeechToTextModelId('openai'));
	return url.toString();
}

async function waitForOpen(socket: WebSocket): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) return;
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});
}

function toUsage(usage: unknown): SttUsage | undefined {
	if (!usage || typeof usage !== 'object') return undefined;
	const value = usage as {
		input_tokens?: number;
		output_tokens?: number;
		total_tokens?: number;
		seconds?: number;
	};
	const next: SttUsage = {
		...(typeof value.input_tokens === 'number' ? { inputTokens: value.input_tokens } : {}),
		...(typeof value.output_tokens === 'number' ? { outputTokens: value.output_tokens } : {}),
		...(typeof value.total_tokens === 'number' ? { totalTokens: value.total_tokens } : {}),
		...(typeof value.seconds === 'number' ? { durationSeconds: value.seconds } : {}),
	};
	return Object.keys(next).length > 0 ? next : undefined;
}
