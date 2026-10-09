import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { OpenAICompatibleRealtimeVoiceAdapter } from './realtime_voice_compatible';
import { createPcmResampler } from './resample';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceProviderSpec,
	RealtimeVoiceServerEvent,
	RealtimeVoiceSocket,
} from './realtime_voice_types';

export const QWEN_REALTIME_VOICE_MODELS = ['qwen3.8-omni-flash-realtime'] as const;

export function createQwenRealtimeVoiceAdapter(
	provider: RealtimeVoiceProviderSpec,
	socketFactory: (url: string, options: WebSocket.ClientOptions) => WebSocket = (url, options) =>
		new WebSocket(url, options)
): RealtimeVoiceAdapter {
	return {
		async connect(request, emit, signal) {
			signal?.throwIfAborted();
			if (!provider.apiKey) throw new Error('Qwen API key not configured.');
			const workspace =
				typeof request.options?.workspace_id === 'string'
					? request.options.workspace_id.trim()
					: '';
			if (!/^[a-z0-9][a-z0-9-]*$/i.test(workspace))
				throw new Error('Qwen realtime voice requires a valid Workspace ID in model settings.');
			const region = request.options?.region ?? 'ap-southeast-1';
			if (region !== 'ap-southeast-1' && region !== 'cn-beijing')
				throw new Error('Qwen realtime voice region must be Singapore or China (Beijing).');
			const url = new URL(`wss://${workspace}.${region}.maas.aliyuncs.com/api-ws/v1/realtime`);
			url.searchParams.set('model', request.modelId);
			const instructions = [
				request.instructions,
				...request.history.map(
					(message) => `Conversation history (${message.role}): ${message.text}`
				),
			].join('\n\n');
			const session: Record<string, unknown> = {
				instructions,
				modalities: ['text', 'audio'],
				input_audio_transcription: { model: 'qwen3-asr-flash-realtime' },
				turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 800 },
				audio: {
					input: {
						format: {
							type: 'pcm',
							sample_rate: 16000,
							sample_format: 's16le',
							channels: 1,
							packing: 'interleaved',
							channel_layout: 'mono',
						},
					},
					output: {
						voice: request.voice.trim() || 'Tina',
						format: { type: 'pcm', sample_rate: 24000 },
					},
				},
				tools: request.tools.map((tool) => ({
					type: 'function',
					function: { name: tool.id, description: tool.description, parameters: tool.schema },
				})),
			};
			for (const key of [
				'temperature',
				'max_tokens',
				'top_p',
				'seed',
				'presence_penalty',
				'repetition_penalty',
			]) {
				const value = request.options?.[key];
				if (typeof value === 'number') session[key] = value;
			}
			const compatible = new OpenAICompatibleRealtimeVoiceAdapter({
				provider,
				modelIds: QWEN_REALTIME_VOICE_MODELS,
				session: () => session,
				socketFactory: () => {
					const socket = socketFactory(url.toString(), {
						headers: { Authorization: `Bearer ${provider.apiKey}` },
					});
					const events = new EventEmitter();
					const resample = createPcmResampler();
					const contexts = new Map<string, string>();
					const send = (event: object): void =>
						socket.send(JSON.stringify({ event_id: randomUUID(), ...event }));
					socket.on('message', (message) => {
						let data: Record<string, unknown>;
						try {
							data = JSON.parse(message.toString());
						} catch {
							return;
						}
						if (typeof data.type !== 'string') return;
						if (data.type.startsWith('response.audio'))
							data.type = data.type.replace('response.audio', 'response.output_audio');
						if (data.type === 'conversation.item.input_audio_transcription.delta') {
							data.type = 'conversation.item.input_audio_transcription.updated';
							data.transcript = `${typeof data.text === 'string' ? data.text : ''}${typeof data.stash === 'string' ? data.stash : ''}`;
						}
						if (data.type === 'conversation.item.input_audio_transcription.failed')
							data.type = 'error';
						events.emit('event', data as unknown as RealtimeVoiceServerEvent);
					});
					socket.on('error', (error) => events.emit('error', error));
					return {
						socket,
						on: (event, listener) => events.on(event, listener),
						send(event) {
							if (event.type === 'input_audio_buffer.append') {
								const audio = resample(Buffer.from(event.audio, 'base64'));
								if (audio.length) send({ ...event, audio: audio.toString('base64') });
								return;
							}
							if (event.type === 'conversation.item.create' && event.item.type === 'message') {
								contexts.set(event.item.id ?? 'context', event.item.content[0].text);
								send({
									type: 'session.update',
									session: { instructions: [instructions, ...contexts.values()].join('\n\n') },
								});
								return;
							}
							if (event.type === 'conversation.item.delete') {
								contexts.delete(event.item_id);
								send({
									type: 'session.update',
									session: { instructions: [instructions, ...contexts.values()].join('\n\n') },
								});
								return;
							}
							send(event);
						},
						close: (props) => socket.close(props?.code ?? 1000, props?.reason),
					} satisfies RealtimeVoiceSocket;
				},
			});
			return compatible.connect({ ...request, history: [] }, emit, signal);
		},
	};
}
