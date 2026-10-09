import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

export function createMiniMaxSttAdapter(spec: SttProviderSpec): SttAdapter {
	if (!spec.apiKey) throw new SttProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async transcribe(request) {
			const form = new FormData();
			form.set('model', request.modelId);
			form.set('file', await createAudioFile(request.audio));
			form.set('response_format', 'json');
			form.set('stream', 'false');
			const response = await fetch(`${spec.baseURL ?? 'https://api.minimax.io/v1'}/speech_to_text`, {
				method: 'POST', body: form, signal: request.signal,
				headers: { Authorization: `Bearer ${spec.apiKey}`, ...(request.language ? { language: request.language } : {}) },
			});
			if (response.status === 401 || response.status === 403) throw new SttProviderAuthError(`${spec.name}: authentication failed.`);
			if (!response.ok) throw new SttProviderRequestError(`${spec.name} request failed (${response.status}): ${await response.text()}`);
			const data = await response.json() as { text?: string; duration?: number };
			if (typeof data.text !== 'string') throw new SttProviderRequestError(`${spec.name}: response contained no transcription.`);
			return { text: data.text, metadata: { providerId: spec.id, providerName: spec.name, modelId: request.modelId, createdAt: new Date().toISOString(), ...(typeof data.duration === 'number' ? { usage: { durationSeconds: data.duration } } : {}) } };
		},
	};
}
