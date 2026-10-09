import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { fetchImageAsBase64, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function createZaiImageAdapter(provider: ImageProviderSpec): ImageAdapter {
	if (!provider.apiKey)
		throw new ImageProviderAuthError(`${provider.name} API key not configured.`);
	return {
		async generate(request) {
			const response = await requestJson<{ data?: { url?: string }[] }>(
				provider.name,
				`${provider.baseURL ?? 'https://api.z.ai/api/paas/v4'}/images/generations`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${provider.apiKey}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						...request.options,
						model: request.modelId,
						prompt: request.prompt,
					}),
					signal: request.signal,
				}
			);
			const url = response.data?.[0]?.url;
			if (!url)
				throw new ImageProviderRequestError(`${provider.name}: response contained no image.`);
			return fetchImageAsBase64(url, request.signal);
		},
	};
}
