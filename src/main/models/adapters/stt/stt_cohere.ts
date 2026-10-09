import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

export function createCohereSttAdapter(provider: SttProviderSpec): SttAdapter {
	if (!provider.apiKey) throw new SttProviderAuthError(`${provider.name} API key not configured.`);
	return {
		async transcribe(request) {
			const form = new FormData();
			form.append('model', request.modelId);
			form.append(
				'language',
				request.language ?? (request.modelId.includes('arabic') ? 'ar' : 'en')
			);
			form.append('file', await createAudioFile(request.audio));
			const response = await fetch(
				new URL('audio/transcriptions', `${provider.baseURL ?? 'https://api.cohere.com/v2'}/`),
				{
					method: 'POST',
					headers: { Authorization: `Bearer ${provider.apiKey}` },
					body: form,
					signal: request.signal,
				}
			);
			if (response.status === 401 || response.status === 403)
				throw new SttProviderAuthError(await response.text());
			if (!response.ok) throw new SttProviderRequestError(await response.text());
			const data = (await response.json()) as { text: string };
			return {
				text: data.text,
				metadata: {
					providerId: provider.id,
					providerName: provider.name,
					modelId: request.modelId,
					language: String(form.get('language')),
					createdAt: new Date().toISOString(),
				},
			};
		},
	};
}
