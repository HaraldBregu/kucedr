import WebSocket from 'ws';
import { SttProviderAuthError, SttProviderUnsupportedError } from './stt_errors';
import type {
	SttAdapter,
	SttAdapterRealtimeStartRequest,
	SttProviderSpec,
	SttRealtimeConnection,
	SttRealtimeEventHandler,
} from './stt_types';

const SESSION_AUTH_SCHEME = 'Bearer';
const SESSION_BETA_HEADER = 'OpenAI-Beta';
const SESSION_BETA_VALUE = 'realtime=v1';
const SESSION_UPDATE_EVENT = 'transcription_session.update';
const SESSION_AUDIO_FORMAT = 'pcm16';

type SessionServerEvent = {
	type?: string;
	item_id?: string;
	content_index?: number;
	delta?: string;
	transcript?: string;
	error?: { message?: string };
};

export function createSessionSttAdapter(provider: SttProviderSpec): SttAdapter {
	if (!provider.apiKey) throw new SttProviderAuthError(`${provider.name} API key not configured.`);

	return {
		async transcribe() {
			throw new SttProviderUnsupportedError(
				`${provider.name} does not expose a batch speech-to-text adapter in this runtime.`
			);
		},

		async startRealtime(
			request: SttAdapterRealtimeStartRequest,
			emit: SttRealtimeEventHandler
		): Promise<SttRealtimeConnection> {
			const socket = new WebSocket(sessionUrl(provider.baseURL, request), {
				headers: {
					Authorization: `${SESSION_AUTH_SCHEME} ${provider.apiKey}`,
					[SESSION_BETA_HEADER]: SESSION_BETA_VALUE,
				},
			});
			await waitForOpen(socket);
			return createSessionConnection(socket, request, emit);
		},
	};
}

function createSessionConnection(
	socket: WebSocket,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): SttRealtimeConnection {
	let closed = false;

	const emitError = (message: string): void => {
		if (!closed) emit({ type: 'error', sessionId: request.sessionId, message });
	};

	const emitClosed = (): void => {
		if (closed) return;
		closed = true;
		emit({ type: 'closed', sessionId: request.sessionId });
	};

	const handleMessage = (message: string): void => {
		let event: SessionServerEvent;
		try {
			event = JSON.parse(message) as SessionServerEvent;
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
			emitError(event.error?.message ?? `${request.providerName} realtime transcription failed.`);
			socket.close(1011, 'transcription failed');
			return;
		}
		if (event.type === 'error') {
			emitError(event.error?.message ?? `${request.providerName} realtime transcription error.`);
		}
	};

	socket.on('message', (data) => handleMessage(data.toString()));
	socket.once('close', () => emitClosed());
	socket.once('error', (error) => emitError(error.message));

	socket.send(
		JSON.stringify({
			type: SESSION_UPDATE_EVENT,
			session: {
				input_audio_format: SESSION_AUDIO_FORMAT,
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

function sessionUrl(baseURL: string, request: SttAdapterRealtimeStartRequest): string {
	const url = new URL(baseURL);
	url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
	url.searchParams.set('model', request.modelId);
	return url.toString();
}

async function waitForOpen(socket: WebSocket): Promise<void> {
	if (socket.readyState === WebSocket.OPEN) return;
	await new Promise<void>((resolve, reject) => {
		socket.once('open', resolve);
		socket.once('error', reject);
	});
}
