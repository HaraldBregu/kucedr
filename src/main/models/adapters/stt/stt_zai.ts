import { createAudioFile } from './stt_audio';
import { SttProviderAuthError, SttProviderRequestError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

export function createZaiSttAdapter(provider: SttProviderSpec): SttAdapter {
	if (!provider.apiKey) throw new SttProviderAuthError(`${provider.name} API key not configured.`);
	return {
		async transcribe(request) {
			const form = new FormData();
			form.append('model', request.modelId);
			form.append('stream', 'false');
			form.append('file', await createAudioFile(request.audio));
			if (request.prompt) form.append('prompt', request.prompt);
			const response = await fetch(
				new URL('/api/paas/v4/audio/transcriptions', provider.baseURL ?? 'https://api.z.ai'),
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
			const result = (await response.json()) as { text: string };
			return {
				text: result.text,
				metadata: {
					providerId: provider.id,
					providerName: provider.name,
					modelId: request.modelId,
					createdAt: new Date().toISOString(),
				},
			};
		},
	};
}
