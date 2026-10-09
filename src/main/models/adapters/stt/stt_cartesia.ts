import WebSocket from 'ws';
import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

export function createCartesiaSttAdapter(provider: SttProviderSpec): SttAdapter {
	if (!provider.apiKey) throw new SttProviderAuthError(`${provider.name} API key not configured.`);
	const baseURL = `${provider.baseURL ?? 'https://api.cartesia.ai'}/`;
	return {
		async transcribe(request) {
			const form = new FormData();
			form.append('model', request.modelId);
			form.append('file', await createAudioFile(request.audio));
			if (request.language) form.append('language', request.language);
			const response = await fetch(new URL('stt', baseURL), {
				method: 'POST',
				headers: { Authorization: `Bearer ${provider.apiKey}`, 'Cartesia-Version': '2026-08-14' },
				body: form,
				signal: request.signal,
			});
			if (response.status === 401 || response.status === 403)
				throw new SttProviderAuthError(await response.text());
			if (!response.ok) throw new SttProviderRequestError(await response.text());
			const data = (await response.json()) as {
				text: string;
				language?: string;
				duration?: number;
			};
			return {
				text: data.text,
				metadata: {
					providerId: provider.id,
					providerName: provider.name,
					modelId: request.modelId,
					createdAt: new Date().toISOString(),
					...(data.language ? { language: data.language } : {}),
					...(typeof data.duration === 'number'
						? { usage: { durationSeconds: data.duration } }
						: {}),
				},
			};
		},
		async startRealtime(request, emit) {
			const endpoint = new URL('stt/websocket', baseURL);
			endpoint.protocol = endpoint.protocol === 'http:' ? 'ws:' : 'wss:';
			endpoint.searchParams.set('model', request.modelId);
			endpoint.searchParams.set('encoding', 'pcm_s16le');
			endpoint.searchParams.set('sample_rate', String(request.sampleRate));
			endpoint.searchParams.set('cartesia_version', '2026-08-14');
			if (request.modelId === 'ink-whisper' && request.language)
				endpoint.searchParams.set('language', request.language);
			if (request.modelId === 'ink-2' && request.prompt)
				endpoint.searchParams.set('keyterm', request.prompt);
			const socket = new WebSocket(endpoint, { headers: { 'X-API-Key': provider.apiKey } });
			let transcript = '';
			let closed = false;
			const emitClosed = (): void => {
				if (!closed) {
					closed = true;
					emit({ type: 'closed', sessionId: request.sessionId });
				}
			};
			socket.on('message', (message) => {
				let data: { type?: string; is_final?: boolean; text?: string; message?: string };
				try {
					data = JSON.parse(message.toString());
				} catch {
					return;
				}
				if (data.type === 'transcript' && data.is_final && data.text) {
					transcript += data.text;
					emit({
						type: 'delta',
						sessionId: request.sessionId,
						itemId: request.sessionId,
						contentIndex: 0,
						delta: data.text,
					});
				}
				if (data.type === 'done') {
					emit({
						type: 'completed',
						sessionId: request.sessionId,
						itemId: request.sessionId,
						contentIndex: 0,
						transcript,
					});
					socket.close(1000, 'completed');
				}
				if (data.type === 'error')
					emit({
						type: 'error',
						sessionId: request.sessionId,
						message: data.message ?? 'Cartesia transcription failed.',
					});
			});
			socket.once('close', emitClosed);
			socket.on('error', (error) =>
				emit({ type: 'error', sessionId: request.sessionId, message: error.message })
			);
			await new Promise<void>((resolve, reject) => {
				socket.once('open', resolve);
				socket.once('error', reject);
			});
			return {
				async appendAudio(audio) {
					socket.send(Buffer.from(audio, 'base64'));
				},
				async finish() {
					socket.send('close');
				},
				async cancel() {
					socket.close(1000, 'cancelled');
					emitClosed();
				},
			};
		},
	};
}
