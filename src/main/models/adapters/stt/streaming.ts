import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import type {
	SttAdapterRealtimeStartRequest,
	SttProviderSpec,
	SttRealtimeConnection,
	SttRealtimeEventHandler,
} from './stt_types';

export async function streaming(
	provider: SttProviderSpec,
	request: SttAdapterRealtimeStartRequest,
	emit: SttRealtimeEventHandler
): Promise<SttRealtimeConnection> {
	const endpoint = new URL(provider.baseURL || 'https://dashscope-intl.aliyuncs.com');
	endpoint.protocol = endpoint.protocol === 'http:' || endpoint.protocol === 'ws:' ? 'ws:' : 'wss:';
	endpoint.pathname = '/api-ws/v1/inference';
	endpoint.search = '';
	const taskId = randomUUID();
	const socket = new WebSocket(endpoint, {
		headers: { Authorization: `Bearer ${provider.apiKey}` },
	});
	const sentences = new Map<number, string>();
	let closed = false;
	let resolveStarted: () => void;
	let rejectStarted: (error: Error) => void;
	const started = new Promise<void>((resolve, reject) => {
		resolveStarted = resolve;
		rejectStarted = reject;
	});
	socket.on('message', (raw) => {
		let event: {
			header?: { event?: string; error_message?: string };
			payload?: {
				output?: {
					sentence?: {
						text?: string;
						sentence_id?: number;
						sentence_end?: boolean;
						heartbeat?: boolean;
					};
				};
			};
		};
		try {
			event = JSON.parse(raw.toString());
		} catch {
			return;
		}
		if (event.header?.event === 'task-started') resolveStarted();
		if (event.header?.event === 'task-failed') {
			const error = new Error(event.header.error_message || 'Qwen transcription failed.');
			rejectStarted(error);
			emit({ type: 'error', sessionId: request.sessionId, message: error.message });
			socket.close();
		}
		if (event.header?.event === 'result-generated') {
			const sentence = event.payload?.output?.sentence;
			if (!sentence || sentence.heartbeat || typeof sentence.text !== 'string') return;
			const index = sentence.sentence_id || 1;
			const previous = sentences.get(index) || '';
			sentences.set(index, sentence.text);
			if (sentence.text.startsWith(previous))
				emit({
					type: 'delta',
					sessionId: request.sessionId,
					itemId: request.sessionId,
					contentIndex: 0,
					delta: sentence.text.slice(previous.length),
				});
		}
		if (event.header?.event === 'task-finished') {
			emit({
				type: 'completed',
				sessionId: request.sessionId,
				itemId: request.sessionId,
				contentIndex: 0,
				transcript: [...sentences.values()].join(' '),
			});
			socket.close();
		}
	});
	socket.once('error', (error) => {
		rejectStarted(error);
		emit({ type: 'error', sessionId: request.sessionId, message: error.message });
	});
	socket.once('close', () => {
		rejectStarted(new Error('Qwen transcription connection closed.'));
		if (!closed) {
			closed = true;
			emit({ type: 'closed', sessionId: request.sessionId });
		}
	});
	socket.once('open', () => {
		socket.send(
			JSON.stringify({
				header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
				payload: {
					task_group: 'audio',
					task: 'asr',
					function: 'recognition',
					model: request.modelId,
					parameters: {
						format: 'pcm',
						sample_rate: request.sampleRate,
						...(request.language ? { language_hints: [request.language] } : {}),
					},
					input: request.prompt
						? {
								context: [
									{ role: 'user', content: [{ type: 'input_text', text: request.prompt }] },
								],
							}
						: {},
				},
			})
		);
	});
	await started;
	return {
		async appendAudio(audio) {
			socket.send(Buffer.from(audio, 'base64'));
		},
		async finish() {
			emit({ type: 'committed', sessionId: request.sessionId, itemId: request.sessionId });
			socket.send(
				JSON.stringify({
					header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
					payload: { input: {} },
				})
			);
		},
		async cancel() {
			socket.close();
		},
	};
}
