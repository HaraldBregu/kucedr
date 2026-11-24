import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { privacyWebSocket } from '../../../privacy/websocket';
import {
	REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH,
	REALTIME_VOICE_SAMPLE_RATE,
} from '../../../../shared/realtime_voice';
import { realtimeVoiceCloseError } from './close';
import { realtimeVoiceSocketUrl } from './endpoint';
import { realtimeVoiceName } from './voice';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceModelSpec,
	RealtimeVoiceProviderSpec,
} from './realtime_voice_types';

const KEEP_ALIVE_MS = 8000;
// ponytail: managed think providers cap the prompt at 25,000 characters
const MAX_PROMPT_LENGTH = 25000;

interface AgentMessage {
	type?: string;
	role?: string;
	content?: string;
	description?: string;
	functions?: { id: string; name: string; arguments?: string; client_side?: boolean }[];
}

export function createAgentVoiceAdapter(
	provider: RealtimeVoiceProviderSpec,
	model: RealtimeVoiceModelSpec,
	socketFactory: (url: string, apiKey: string) => WebSocket = (url, apiKey) =>
		privacyWebSocket(url, { headers: { Authorization: `Token ${apiKey}` } })
): RealtimeVoiceAdapter {
	return {
		async connect(request, emit, signal) {
			signal?.throwIfAborted();
			if (!provider.apiKey) throw new Error(`${provider.name} API key not configured.`);
			const option = (key: string): string => {
				const value = request.options?.[key] ?? model.metadata?.inputs[key]?.default;
				return typeof value === 'string' ? value.trim() : '';
			};
			const url = realtimeVoiceSocketUrl(model, request.options, provider.name);
			const socket = socketFactory(url.toString(), provider.apiKey);
			let closed = false;
			let responseId = '';
			let userId = randomUUID();
			let assistantTranscript = '';
			const calls = new Map<string, string>();
			const keepAlive = setInterval(() => {
				if (!closed && socket.readyState === WebSocket.OPEN)
					socket.send(JSON.stringify({ type: 'KeepAlive' }));
			}, KEEP_ALIVE_MS);
			keepAlive.unref?.();
			const send = (event: object): void => {
				if (closed || socket.readyState !== WebSocket.OPEN)
					throw new Error(`${provider.name} voice connection is closed.`);
				socket.send(JSON.stringify(event));
			};
			const beginResponse = (): string => {
				if (!responseId) {
					responseId = randomUUID();
					emit({ type: 'response_started', responseId });
				}
				return responseId;
			};
			const endResponse = (): void => {
				if (!responseId) return;
				if (assistantTranscript)
					emit({
						type: 'assistant_transcript_final',
						itemId: responseId,
						responseId,
						transcript: assistantTranscript,
					});
				emit({ type: 'assistant_audio_done', itemId: responseId, responseId });
				emit({ type: 'response_done', responseId });
				responseId = '';
				assistantTranscript = '';
			};
			const stop = async (): Promise<void> => {
				if (closed) return;
				closed = true;
				clearInterval(keepAlive);
				signal?.removeEventListener('abort', abort);
				socket.close(1000, 'Voice session stopped.');
			};
			const abort = (): void => {
				void stop();
			};
			const listenModel = option('listen_model');
			const [thinkType, ...thinkModel] = option('think_model').split('/');
			await new Promise<void>((resolve, reject) => {
				let ready = false;
				const timer = setTimeout(() => {
					reject(new Error(`${provider.name} voice connection timed out.`));
					void stop();
				}, 15000);
				timer.unref?.();
				signal?.addEventListener('abort', abort, { once: true });
				socket.on('message', (data, isBinary) => {
					if (closed) return;
					if (isBinary) {
						const id = beginResponse();
						emit({
							type: 'assistant_audio_delta',
							itemId: id,
							responseId: id,
							audio: Buffer.from(data as Buffer).toString('base64'),
						});
						return;
					}
					let event: AgentMessage;
					try {
						event = JSON.parse(data.toString()) as AgentMessage;
					} catch {
						emit({ type: 'error', message: `${provider.name} voice returned an invalid message.` });
						return;
					}
					if (event.type === 'Welcome') {
						send({
							type: 'Settings',
							audio: {
								input: { encoding: 'linear16', sample_rate: REALTIME_VOICE_SAMPLE_RATE },
								output: {
									encoding: 'linear16',
									sample_rate: REALTIME_VOICE_SAMPLE_RATE,
									container: 'none',
								},
							},
							agent: {
								listen: {
									provider: {
										type: 'deepgram',
										version: listenModel.startsWith('flux') ? 'v2' : 'v1',
										model: listenModel,
									},
								},
								think: {
									provider: { type: thinkType, model: thinkModel.join('/') },
									prompt: request.instructions.slice(0, MAX_PROMPT_LENGTH),
									functions: request.tools.map((tool) => ({
										name: tool.id,
										description: tool.description,
										parameters: tool.schema,
									})),
								},
								speak: {
									provider: { type: 'deepgram', model: realtimeVoiceName(request.voice, model) },
								},
								...(request.history.length
									? {
											context: {
												messages: request.history.map((message) => ({
													type: 'History',
													role: message.role,
													content: message.text,
												})),
											},
										}
									: {}),
							},
						});
						return;
					}
					if (event.type === 'SettingsApplied') {
						ready = true;
						clearTimeout(timer);
						resolve();
						return;
					}
					if (event.type === 'Error') {
						const error = new Error(event.description || `${provider.name} voice request failed.`);
						if (!ready) {
							clearTimeout(timer);
							reject(error);
							void stop();
						} else emit({ type: 'error', message: error.message });
						return;
					}
					if (event.type === 'UserStartedSpeaking') {
						endResponse();
						userId = randomUUID();
						emit({ type: 'input_speech_started', itemId: userId });
						return;
					}
					if (event.type === 'AgentThinking') {
						beginResponse();
						return;
					}
					if (event.type === 'ConversationText' && event.content) {
						if (event.role === 'user') {
							emit({ type: 'input_speech_stopped', itemId: userId });
							emit({ type: 'user_transcript_final', itemId: userId, transcript: event.content });
							return;
						}
						const id = beginResponse();
						const delta = assistantTranscript ? ` ${event.content}` : event.content;
						assistantTranscript += delta;
						emit({ type: 'assistant_transcript_delta', itemId: id, responseId: id, delta });
						return;
					}
					if (event.type === 'FunctionCallRequest') {
						for (const call of event.functions ?? []) {
							if (!call.client_side) continue;
							const id = beginResponse();
							calls.set(call.id, call.name);
							emit({
								type: 'tool_call_start',
								callId: call.id,
								itemId: call.id,
								responseId: id,
								name: call.name,
							});
							emit({
								type: 'tool_call',
								callId: call.id,
								itemId: call.id,
								responseId: id,
								name: call.name,
								arguments: call.arguments || '{}',
							});
						}
						return;
					}
					if (event.type === 'FunctionCallCancelled') {
						for (const call of event.functions ?? []) {
							calls.delete(call.id);
							emit({ type: 'tool_call_cancel', callId: call.id });
						}
						return;
					}
					if (event.type === 'AgentAudioDone') endResponse();
				});
				socket.on('error', () => {
					clearTimeout(timer);
					if (!ready) {
						reject(new Error(`${provider.name} voice connection failed.`));
						void stop();
					} else emit({ type: 'error', message: `${provider.name} voice connection failed.` });
				});
				socket.on('close', (code, reason) => {
					clearTimeout(timer);
					clearInterval(keepAlive);
					signal?.removeEventListener('abort', abort);
					const error = closed
						? null
						: realtimeVoiceCloseError(code, reason, `${provider.name} voice connection closed`);
					closed = true;
					if (!ready)
						reject(error ?? new Error(`${provider.name} voice connection closed before setup.`));
					else if (error) emit({ type: 'error', message: error.message });
					else emit({ type: 'closed' });
				});
				if (signal?.aborted) abort();
			});
			return {
				async appendAudio(audio) {
					if (socket.bufferedAmount + audio.length > REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH)
						throw new Error(`${provider.name} voice transport queue is full.`);
					if (closed || socket.readyState !== WebSocket.OPEN)
						throw new Error(`${provider.name} voice connection is closed.`);
					socket.send(Buffer.from(audio, 'base64'));
				},
				// ponytail: Deepgram stops speaking on its own when it hears the user; no client message exists
				async interrupt() {
					endResponse();
				},
				async addToolResult(callId, output) {
					const name = calls.get(callId);
					if (!name || closed) return;
					calls.delete(callId);
					send({ type: 'FunctionCallResponse', id: callId, name, content: output });
				},
				stop,
			};
		},
	};
}
