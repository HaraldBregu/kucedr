import { speechToTextBaseUrl } from '../../../models';
import WebSocket from 'ws';
import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type {
	SttAdapter,
	SttAdapterRealtimeStartRequest,
	SttAdapterTranscriptionRequest,
	SttProviderSpec,
	SttRealtimeConnection,
	SttRealtimeEventHandler,
} from './stt_types';
import type { SttTranscriptionResult, SttUsage } from '../../../../shared/stt_transcription';

const XAI_STT_PATH = 'stt';
const XAI_STT_AUTH_SCHEME = 'Bearer';
const XAI_REALTIME_AUDIO_DONE = 'audio.done';

type XaiTranscriptionResponse = {
	text?: string;
	language?: string;
	duration?: number;
	segments?: Array<{ text?: string }>;
};

type XaiRealtimeResponse = {
	type?: string;
	text?: string;
	delta?: string;
	error?: { message?: unknown };
};

export interface XaiSttAdapterOptions extends SttProviderSpec {
	fetchFactory?: typeof fetch;
}

export function createXaiSttAdapter(opts: XaiSttAdapterOptions): SttAdapter {
	if (!opts.apiKey) throw new SttProviderAuthError(`${opts.name} API key not configured.`);
	const provider = opts;
	const fetcher = opts.fetchFactory ?? fetch;

	return {
		async transcribe(request: SttAdapterTranscriptionRequest): Promise<SttTranscriptionResult> {
			const file = await createAudioFile(request.audio);
			const form = new FormData();
			if (request.language) form.append('language', request.language);
			if (request.prompt) form.append('prompt', request.prompt);
			form.append('file', file);

			const response = await fetcher(xaiSttUrl(provider.baseURL), {
				method: 'POST',
				headers: {
					Authorization: `${XAI_STT_AUTH_SCHEME} ${provider.apiKey}`,
				},
				body: form,
				signal: request.signal,
			});
			if (response.status === 401 || response.status === 403) {
				throw new SttProviderAuthError(await response.text());
			}
			if (!response.ok) {
				throw new SttProviderRequestError(await response.text());
			}

			const data = (await response.json()) as XaiTranscriptionResponse;
			const text = data.text ?? data.segments?.map((segment) => segment.text ?? '').join('') ?? '';
			const usage = toUsage(data);

			return {
				text,
				metadata: {
					providerId: provider.id,
					providerName: provider.name,
					modelId: request.modelId,
					...(data.language || request.language
						? { language: data.language ?? request.language }
						: {}),
					createdAt: new Date().toISOString(),
					...(usage ? { usage } : {}),
				},
			};
		},

		async startRealtime(
			request: SttAdapterRealtimeStartRequest,
			emit: SttRealtimeEventHandler
		): Promise<SttRealtimeConnection> {
			const socket = new WebSocket(xaiRealtimeUrl(provider.baseURL), {
				headers: {
					Authorization: `${XAI_STT_AUTH_SCHEME} ${provider.apiKey}`,
				},
			});
			await waitForOpen(socket);
			return createXaiRealtimeConnection(socket, request, emit);
		},
	};
}

function createXaiRealtimeConnection(
	socket: WebSocket,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): SttRealtimeConnection {
	let closed = false;
	let transcript = '';

	const emitError = (message: string): void => {
		if (!closed) emit({ type: 'error', sessionId: request.sessionId, message });
	};

	const emitClosed = (): void => {
		if (closed) return;
		closed = true;
		emit({ type: 'closed', sessionId: request.sessionId });
	};

	const handleMessage = (message: string): void => {
		let data: XaiRealtimeResponse;
		try {
			data = JSON.parse(message) as XaiRealtimeResponse;
		} catch {
			return;
		}

		if (data.type === 'transcript.partial' && data.delta) {
			transcript += data.delta;
			emit({
				type: 'delta',
				sessionId: request.sessionId,
				itemId: request.sessionId,
				contentIndex: 0,
				delta: data.delta,
			});
			return;
		}
		if (data.type === 'transcript.done') {
			const finalTranscript = data.text ?? transcript;
			emit({
				type: 'completed',
				sessionId: request.sessionId,
				itemId: request.sessionId,
				contentIndex: 0,
				transcript: finalTranscript,
			});
			socket.close(1000, 'completed');
			return;
		}
		if (data.type === 'error') {
			emitError(errorMessage(data.error, 'xAI realtime transcription error.'));
		}
	};

	socket.on('message', (data, isBinary) => {
		if (!isBinary) handleMessage(data.toString());
	});
	socket.once('close', () => emitClosed());
	socket.once('error', (error) => emitError(error.message));

	return {
		async appendAudio(audio: string): Promise<void> {
			socket.send(Buffer.from(audio, 'base64'));
		},

		async finish(): Promise<void> {
			socket.send(JSON.stringify({ type: XAI_REALTIME_AUDIO_DONE }));
		},

		async cancel(): Promise<void> {
			socket.close(1000, 'cancelled');
			emitClosed();
		},
	};
}

function xaiSttUrl(baseURL: string | undefined): URL {
	return new URL(
		XAI_STT_PATH,
		`${baseURL ?? speechToTextBaseUrl('xai')}/`
	);
}

function xaiRealtimeUrl(baseURL: string | undefined): string {
	const url = xaiSttUrl(baseURL);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	return url.toString();
}

async function waitForOpen(socket: WebSocket): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) return;
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});
}

function errorMessage(error: unknown, fallback: string): string {
	if (
		error &&
		typeof error === 'object' &&
		typeof (error as { message?: unknown }).message === 'string'
	) {
		return (error as { message: string }).message;
	}
	return fallback;
}

function toUsage(data: XaiTranscriptionResponse): SttUsage | undefined {
	return typeof data.duration === 'number' ? { durationSeconds: data.duration } : undefined;
}
