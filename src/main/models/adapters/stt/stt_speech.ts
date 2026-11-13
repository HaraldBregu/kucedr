import { createAudioFile } from './stt_audio';
import WebSocket from 'ws';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type {
	SttAdapter,
	SttAdapterRealtimeStartRequest,
	SttAdapterTranscriptionRequest,
	SttProviderSpec,
	SttRealtimeConnection,
	SttRealtimeEventHandler,
} from './stt_types';
import type { SttTranscriptionResult } from '../../../../shared/stt_transcription';

const SPEECH_STT_PATH = 'speech-to-text';
const SPEECH_REALTIME_STT_PATH = 'speech-to-text/realtime';
const SPEECH_API_KEY_HEADER = 'xi-api-key';
const SPEECH_AUDIO_FORMAT_PREFIX = 'pcm';
const SPEECH_INPUT_AUDIO_CHUNK_MESSAGE = 'input_audio_chunk';

type SpeechTranscriptionResponse = {
	text?: string;
	language_code?: string;
	languageCode?: string;
};

type SpeechRealtimeResponse = {
	message_type?: string;
	text?: string;
	transcript?: string;
	error?: string;
};

export interface SpeechSttAdapterOptions extends SttProviderSpec {
	fetchFactory?: typeof fetch;
}

export function createSpeechSttAdapter(opts: SpeechSttAdapterOptions): SttAdapter {
	if (!opts.apiKey) throw new SttProviderAuthError(`${opts.name} API key not configured.`);
	const provider = opts;
	const fetcher = opts.fetchFactory ?? fetch;

	return {
		async transcribe(request: SttAdapterTranscriptionRequest): Promise<SttTranscriptionResult> {
			const file = await createAudioFile(request.audio);
			const form = new FormData();
			form.append('file', file);
			form.append('model_id', request.modelId);
			if (request.language) form.append('language_code', request.language);
			if (request.prompt) form.append('prompt', request.prompt);

			const endpoint = new URL(SPEECH_STT_PATH, `${provider.baseURL}/`);
			const response = await fetcher(endpoint, {
				method: 'POST',
				headers: {
					[SPEECH_API_KEY_HEADER]: provider.apiKey,
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

			const data = (await response.json()) as SpeechTranscriptionResponse;

			return {
				text: data.text ?? '',
				metadata: {
					providerId: provider.id,
					providerName: provider.name,
					modelId: request.modelId,
					...(data.language_code || data.languageCode || request.language
						? { language: data.language_code ?? data.languageCode ?? request.language }
						: {}),
					createdAt: new Date().toISOString(),
				},
			};
		},

		async startRealtime(
			request: SttAdapterRealtimeStartRequest,
			emit: SttRealtimeEventHandler
		): Promise<SttRealtimeConnection> {
			const socket = new WebSocket(speechRealtimeUrl(provider.baseURL, request), {
				headers: {
					[SPEECH_API_KEY_HEADER]: provider.apiKey,
				},
			});
			await waitForOpen(socket);
			return createSpeechRealtimeConnection(socket, request, emit);
		},
	};
}

function createSpeechRealtimeConnection(
	socket: WebSocket,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): SttRealtimeConnection {
	let closed = false;
	let partial = '';

	const emitError = (message: string): void => {
		if (!closed) emit({ type: 'error', sessionId: request.sessionId, message });
	};

	const emitClosed = (): void => {
		if (closed) return;
		closed = true;
		emit({ type: 'closed', sessionId: request.sessionId });
	};

	const handleMessage = (message: string): void => {
		let data: SpeechRealtimeResponse;
		try {
			data = JSON.parse(message) as SpeechRealtimeResponse;
		} catch {
			return;
		}

		if (data.message_type === 'partial_transcript' && data.text) {
			const delta = data.text.startsWith(partial)
				? data.text.slice(partial.length)
				: data.text;
			partial = data.text;
			emit({
				type: 'delta',
				sessionId: request.sessionId,
				itemId: request.sessionId,
				contentIndex: 0,
				delta,
			});
			return;
		}
		if (
			(data.message_type === 'committed_transcript' ||
				data.message_type === 'committed_transcript_with_timestamps') &&
			(data.transcript || data.text)
		) {
			emit({
				type: 'completed',
				sessionId: request.sessionId,
				itemId: request.sessionId,
				contentIndex: 0,
				transcript: data.transcript ?? data.text ?? '',
			});
			socket.close(1000, 'completed');
			return;
		}
		if (data.message_type === 'error') {
			emitError(data.error ?? `${request.providerName} realtime transcription error.`);
		}
	};

	socket.on('message', (data) => handleMessage(data.toString()));
	socket.once('close', () => emitClosed());
	socket.once('error', (error) => emitError(error.message));

	return {
		async appendAudio(audio: string): Promise<void> {
			socket.send(
				JSON.stringify({
					message_type: SPEECH_INPUT_AUDIO_CHUNK_MESSAGE,
					audio_base_64: audio,
					commit: false,
				})
			);
		},

		async finish(): Promise<void> {
			socket.send(
				JSON.stringify({
					message_type: SPEECH_INPUT_AUDIO_CHUNK_MESSAGE,
					audio_base_64: '',
					commit: true,
				})
			);
		},

		async cancel(): Promise<void> {
			socket.close(1000, 'cancelled');
			emitClosed();
		},
	};
}

function speechRealtimeUrl(baseURL: string, request: SttAdapterRealtimeStartRequest): string {
	const url = new URL(SPEECH_REALTIME_STT_PATH, `${baseURL}/`);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	url.searchParams.set('model_id', request.modelId);
	url.searchParams.set('audio_format', `${SPEECH_AUDIO_FORMAT_PREFIX}_${request.sampleRate}`);
	if (request.language) url.searchParams.set('language_code', request.language);
	return url.toString();
}

async function waitForOpen(socket: WebSocket): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) return;
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});
}
