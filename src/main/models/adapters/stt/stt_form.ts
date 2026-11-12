import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';
import { inputDefault } from '../tts/defaults';

export function createFormSttAdapter(provider: SttProviderSpec): SttAdapter {
	if (!provider.apiKey) throw new SttProviderAuthError(`${provider.name} API key not configured.`);
	return {
		async transcribe(request) {
			const form = new FormData();
			form.append('model', request.modelId);
			const language = request.language ?? inputDefault(request.metadata, ['language']);
			if (language !== undefined) form.append('language', String(language));
			if (typeof request.temperature === 'number')
				form.append('temperature', String(request.temperature));
			form.append('file', await createAudioFile(request.audio));
			const response = await fetch(
				new URL('audio/transcriptions', `${provider.baseURL}/`),
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
					...(language !== undefined ? { language: String(language) } : {}),
					createdAt: new Date().toISOString(),
				},
			};
		},
	};
}
