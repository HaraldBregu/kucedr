import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH } from '../../../../shared/realtime_voice';
import { realtimeVoiceCloseError } from './close';
import { turnContext } from './context';
import type { RealtimeVoiceAdapter, RealtimeVoiceProviderSpec } from './realtime_voice_types';

export const GOOGLE_LIVE_MODELS = ['gemini-3.8-live', 'gemini-3.8-live-extended-thinking'] as const;

interface GoogleLiveMessage {
	setupComplete?: object;
	error?: { message?: string };
	voiceActivity?: { type?: string };
	toolCall?: { functionCalls?: { id: string; name: string; args?: unknown }[] };
	toolCallCancellation?: { ids?: string[] };
	serverContent?: {
		interrupted?: boolean;
		turnComplete?: boolean;
		generationComplete?: boolean;
		interactionStatus?: string;
		inputTranscription?: { text?: string };
		outputTranscription?: { text?: string };
		modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] };
	};
}

export function createGoogleRealtimeVoiceAdapter(
	provider: RealtimeVoiceProviderSpec,
	socketFactory: (url: string) => WebSocket = (url) => new WebSocket(url)
): RealtimeVoiceAdapter {
	return {
		async connect(request, emit, signal) {
			signal?.throwIfAborted();
			if (!provider.apiKey) throw new Error('Google API key not configured.');
			if (!GOOGLE_LIVE_MODELS.some((id) => id === request.modelId)) {
				throw new Error(`Google realtime voice model is not supported: ${request.modelId}`);
			}
			const url = new URL(
				'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'
			);
			url.searchParams.set('key', provider.apiKey);
			const socket = socketFactory(url.toString());
			let closed = false;
			let responseId = '';
			let userId = randomUUID();
			let userTranscript = '';
			let assistantTranscript = '';
			let generation = 0;
			const calls = new Map<string, string>();
			const send = (event: object): void => {
				if (closed || socket.readyState !== WebSocket.OPEN)
					throw new Error('Google voice connection is closed.');
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
				generation += 1;
				signal?.removeEventListener('abort', abort);
				socket.close(1000, 'Voice session stopped.');
			};
			const abort = (): void => {
				void stop();
			};
			await new Promise<void>((resolve, reject) => {
				let ready = false;
				const timer = setTimeout(() => {
					reject(new Error('Google voice connection timed out.'));
					void stop();
				}, 15000);
				timer.unref?.();
				signal?.addEventListener('abort', abort, { once: true });
				socket.on('open', () => {
					if (closed) return;
					send({
						setup: {
							model: `models/${request.modelId}`,
							generationConfig: {
								responseModalities: ['AUDIO'],
								speechConfig: {
									voiceConfig: { prebuiltVoiceConfig: { voiceName: request.voice || 'Kore' } },
								},
								...(request.modelId.endsWith('extended-thinking')
									? { thinkingConfig: { thinkingLevel: 'low' } }
									: {}),
							},
							systemInstruction: { parts: [{ text: request.instructions }] },
							inputAudioTranscription: {},
							outputAudioTranscription: {},
							...(request.history.length
								? { historyConfig: { initialHistoryInClientContent: true } }
								: {}),
							tools: request.tools.length
								? [
										{
											functionDeclarations: request.tools.map((tool) => ({
												name: tool.id,
												description: tool.description,
												parametersJsonSchema: tool.schema,
												behavior: 'NON_BLOCKING',
											})),
										},
									]
								: [],
						},
					});
				});
				socket.on('message', (data) => {
					if (closed) return;
					let event: GoogleLiveMessage;
					try {
						event = JSON.parse(data.toString()) as GoogleLiveMessage;
					} catch {
						emit({ type: 'error', message: 'Google voice returned an invalid message.' });
						return;
					}
					if (event.setupComplete) {
						if (request.history.length)
							send({
								clientContent: {
									turns: request.history.map((message) => ({
										role: message.role === 'assistant' ? 'model' : 'user',
										parts: [{ text: message.text }],
									})),
									turnComplete: true,
								},
							});
						ready = true;
						clearTimeout(timer);
						resolve();
					}
					if (event.error) {
						const error = new Error(event.error.message || 'Google voice request failed.');
						if (!ready) {
							clearTimeout(timer);
							reject(error);
							void stop();
						} else emit({ type: 'error', message: error.message });
					}
					if (event.voiceActivity?.type === 'ACTIVITY_START') {
						userId = randomUUID();
						userTranscript = '';
						generation += 1;
						emit({ type: 'input_speech_started', itemId: userId });
					}
					if (event.voiceActivity?.type === 'ACTIVITY_END')
						emit({ type: 'input_speech_stopped', itemId: userId });
					const content = event.serverContent;
					if (content?.inputTranscription?.text) {
						userTranscript += content.inputTranscription.text;
						emit({ type: 'user_transcript_update', itemId: userId, transcript: userTranscript });
						emit({ type: 'user_transcript_final', itemId: userId, transcript: userTranscript });
						const current = generation;
						void turnContext(request.contextForTurn, userTranscript).then((context) => {
							if (context && !closed && current === generation)
								send({
									realtimeInput: {
										text: `Remembered reference data for the current request:\n${context}`,
									},
								});
						});
					}
					if (content?.outputTranscription?.text) {
						const id = beginResponse();
						const delta = content.outputTranscription.text;
						assistantTranscript += delta;
						emit({ type: 'assistant_transcript_delta', itemId: id, responseId: id, delta });
					}
					for (const part of content?.modelTurn?.parts ?? []) {
						if (part.inlineData?.data && part.inlineData.mimeType?.startsWith('audio/pcm')) {
							const id = beginResponse();
							emit({
								type: 'assistant_audio_delta',
								itemId: id,
								responseId: id,
								audio: part.inlineData.data,
							});
						}
					}
					for (const call of event.toolCall?.functionCalls ?? []) {
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
							arguments: JSON.stringify(call.args ?? {}),
						});
					}
					for (const id of event.toolCallCancellation?.ids ?? []) {
						calls.delete(id);
						emit({ type: 'tool_call_cancel', callId: id });
					}
					if (content?.interrupted) {
						generation += 1;
						endResponse();
					}
					if (content?.turnComplete && content.interactionStatus !== 'IN_PROGRESS') endResponse();
				});
				socket.on('error', () => {
					clearTimeout(timer);
					if (!ready) {
						reject(new Error('Google voice connection failed.'));
						void stop();
					} else emit({ type: 'error', message: 'Google voice connection failed.' });
				});
				socket.on('close', (code, reason) => {
					clearTimeout(timer);
					signal?.removeEventListener('abort', abort);
					const error = closed
						? null
						: realtimeVoiceCloseError(code, reason, 'Google voice connection closed');
					closed = true;
					if (!ready) reject(error ?? new Error('Google voice connection closed before setup.'));
					else if (error) emit({ type: 'error', message: error.message });
					else emit({ type: 'closed' });
				});
				if (signal?.aborted) abort();
			});
			return {
				async appendAudio(audio) {
					if (socket.bufferedAmount + audio.length > REALTIME_VOICE_MAX_AUDIO_BASE64_LENGTH)
						throw new Error('Google voice transport queue is full.');
					send({ realtimeInput: { audio: { data: audio, mimeType: 'audio/pcm;rate=24000' } } });
				},
				async interrupt() {
					generation += 1;
					if (responseId) send({ clientContent: { turns: [], turnComplete: true } });
				},
				async addToolResult(callId, output) {
					const name = calls.get(callId);
					if (!name || closed) return;
					calls.delete(callId);
					send({
						toolResponse: {
							functionResponses: [{ id: callId, name, response: { result: output } }],
						},
					});
				},
				stop,
			};
		},
	};
}
