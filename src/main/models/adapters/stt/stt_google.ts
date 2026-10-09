import { requestGoogleInteraction } from '../google/interaction';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

export function createGoogleSttAdapter(spec: SttProviderSpec): SttAdapter {
	if (!spec.apiKey) throw new SttProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async transcribe(request) {
			const content = await requestGoogleInteraction(spec, {
				model: request.modelId,
				input: [{ type: 'audio', data: request.audio.data, mime_type: request.audio.mimeType }],
				generation_config: { transcription_config: {
					...(request.language ? { language_codes: [request.language] } : {}),
					...(request.prompt ? { custom_vocabulary: [request.prompt] } : {}),
				} },
			}, { auth: SttProviderAuthError, request: SttProviderRequestError }, request.signal);
			const text = content.filter((part) => part.type === 'text').map((part) => part.text ?? '').join('\n');
			return { text, metadata: { providerId: spec.id, providerName: spec.name, modelId: request.modelId,
				...(request.language ? { language: request.language } : {}), createdAt: new Date().toISOString() } };
		},
	};
}
