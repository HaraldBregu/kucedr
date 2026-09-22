import { speechToTextBaseUrl, realtimeSpeechToTextModelId } from '../../../models';
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

const DEEPGRAM_LISTEN_PATH = 'listen';
const DEEPGRAM_FLUX_LISTEN_PATH = '../v2/listen';
const DEEPGRAM_AUTH_SCHEME = 'Token';
const DEEPGRAM_LINEAR16_ENCODING = 'linear16';

type DeepgramTranscriptionResponse = {
	metadata?: {
		duration?: number;
	};
	results?: {
		channels?: Array<{
			alternatives?: Array<{
				transcript?: string;
			}>;
		}>;
	};
};

export interface DeepgramSttAdapterOptions extends SttProviderSpec {
	fetchFactory?: typeof fetch;
}

export function createDeepgramSttAdapter(opts: DeepgramSttAdapterOptions): SttAdapter {
	if (!opts.apiKey) throw new SttProviderAuthError(`${opts.name} API key not configured.`);
	const provider = opts;
	const fetcher = opts.fetchFactory ?? fetch;

	return {
		async transcribe(request: SttAdapterTranscriptionRequest): Promise<SttTranscriptionResult> {
			const file = await createAudioFile(request.audio);
			const body = Buffer.from(await file.arrayBuffer());
			const endpoint = new URL(
				DEEPGRAM_LISTEN_PATH,
				`${provider.baseURL ?? speechToTextBaseUrl('deepgram')}/`
			);
			endpoint.searchParams.set('model', request.modelId);
			if (request.language) endpoint.searchParams.set('language', request.language);
			if (request.prompt) endpoint.searchParams.set('keywords', request.prompt);

			const response = await fetcher(endpoint, {
				method: 'POST',
				headers: {
					Authorization: `${DEEPGRAM_AUTH_SCHEME} ${provider.apiKey}`,
					'Content-Type': request.audio.mimeType,
				},
				body,
				signal: request.signal,
			});
			if (response.status === 401 || response.status === 403) {
				throw new SttProviderAuthError(await response.text());
			}
			if (!response.ok) {
				throw new SttProviderRequestError(await response.text());
			}

			const data = (await response.json()) as DeepgramTranscriptionResponse;
			const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
			const usage = toUsage(data.metadata);

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
		},

		async startRealtime(
			request: SttAdapterRealtimeStartRequest,
			emit: SttRealtimeEventHandler
		): Promise<SttRealtimeConnection> {
			const socket = new WebSocket(deepgramRealtimeUrl(provider.baseURL, request), {
				headers: { Authorization: `${DEEPGRAM_AUTH_SCHEME} ${provider.apiKey}` },
			});
			await waitForOpen(socket);
			return createDeepgramRealtimeConnection(socket, request, emit);
		},
	};
}

type DeepgramRealtimeResponse = {
	type?: string;
	is_final?: boolean;
	speech_final?: boolean;
	channel?: {
		alternatives?: Array<{
			transcript?: string;
		}>;
	};
};

function createDeepgramRealtimeConnection(
	socket: WebSocket,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): SttRealtimeConnection {
	let closed = false;
	let completedCount = 0;

	const emitError = (message: string): void => {
		if (!closed) emit({ type: 'error', sessionId: request.sessionId, message });
	};

	const emitClosed = (): void => {
		if (closed) return;
		closed = true;
		emit({ type: 'closed', sessionId: request.sessionId });
	};

	const handleMessage = (message: string): void => {
		let data: DeepgramRealtimeResponse;
		try {
			data = JSON.parse(message) as DeepgramRealtimeResponse;
		} catch {
			return;
		}
		if (data.type === 'CloseStream') {
			socket.close(1000, 'completed');
			return;
		}
		if (data.type === 'TurnInfo') {
			const transcript = data.channel?.alternatives?.[0]?.transcript;
			if (!transcript) return;
			completedCount += 1;
			emit({
				type: 'completed',
				sessionId: request.sessionId,
				itemId: `${request.sessionId}-${completedCount}`,
				contentIndex: 0,
				transcript,
			});
			return;
		}
		const transcript = data.channel?.alternatives?.[0]?.transcript;
		if (!transcript) return;

		if (data.speech_final) {
			emit({
				type: 'committed',
				sessionId: request.sessionId,
				itemId: request.sessionId,
			});
		}
		if (data.is_final) {
			completedCount += 1;
			emit({
				type: 'completed',
				sessionId: request.sessionId,
				itemId: `${request.sessionId}-${completedCount}`,
				contentIndex: 0,
				transcript,
			});
			return;
		}
		emit({
			type: 'delta',
			sessionId: request.sessionId,
			itemId: request.sessionId,
			contentIndex: 0,
			delta: transcript,
		});
	};

	socket.on('message', (data) => handleMessage(data.toString()));
	socket.once('close', () => emitClosed());
	socket.once('error', (error) => emitError(error.message));

	return {
		async appendAudio(audio: string): Promise<void> {
			socket.send(Buffer.from(audio, 'base64'));
		},

		async finish(): Promise<void> {
			socket.send(JSON.stringify({ type: 'CloseStream' }));
		},

		async cancel(): Promise<void> {
			socket.close(1000, 'cancelled');
			emitClosed();
		},
	};
}

function deepgramRealtimeUrl(
	baseURL: string | undefined,
	request: SttAdapterRealtimeStartRequest
): string {
	const path =
		request.modelId === realtimeSpeechToTextModelId('deepgram')
			? DEEPGRAM_FLUX_LISTEN_PATH
			: DEEPGRAM_LISTEN_PATH;
	const url = new URL(
		path,
		`${baseURL ?? speechToTextBaseUrl('deepgram')}/`
	);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	url.searchParams.set('model', request.modelId);
	url.searchParams.set('encoding', DEEPGRAM_LINEAR16_ENCODING);
	url.searchParams.set('sample_rate', String(request.sampleRate));
	url.searchParams.set('channels', '1');
	url.searchParams.set('interim_results', 'true');
	url.searchParams.set('smart_format', 'true');
	if (request.language) url.searchParams.set('language', request.language);
	return url.toString();
}

async function waitForOpen(socket: WebSocket): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) return;
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});
}

function toUsage(metadata: DeepgramTranscriptionResponse['metadata']): SttUsage | undefined {
	if (!metadata || typeof metadata.duration !== 'number') return undefined;
	return { durationSeconds: metadata.duration };
}
