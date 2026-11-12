import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { fetchImageAsBase64, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

type KeyedResponse = { data?: Array<{ url?: string }> };

export function createKeyedImageAdapter(
	spec: ImageProviderSpec,
	imageRequest: boolean
): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL;
	const headers = { 'Api-Key': spec.apiKey, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const options = request.options ?? {};
			const payload = {
				[request.promptField ?? 'prompt']: request.prompt,
				...options,
			};
			const form = request.source ? new FormData() : undefined;
			if (form && request.source) {
				for (const [key, value] of Object.entries(payload)) {
					if (value !== undefined)
						form.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
				}
				form.append(
					'images',
					new Blob([Buffer.from(request.source.base64, 'base64')], {
						type: request.source.mimeType,
					}),
					'source.png'
				);
			}
			const response = imageRequest
				? await requestJson<KeyedResponse>(spec.name, `${baseURL}/generate`, {
						method: 'POST',
						headers,
						body: JSON.stringify({
							image_request: { prompt: request.prompt, model: request.modelId, ...request.options },
						}),
						signal: request.signal,
					})
				: await requestJson<KeyedResponse>(
						spec.name,
						`${baseURL}${request.endpoint ?? '/v1/ideogram-v3/generate'}`,
						{
							method: 'POST',
							headers: form ? { 'Api-Key': spec.apiKey } : headers,
							body: form ?? JSON.stringify(payload),
							signal: request.signal,
						}
					);
			const url = response.data?.[0]?.url;
			if (!url) throw new ImageProviderRequestError(`${spec.name}: response contained no image.`);
			return fetchImageAsBase64(url, request.signal);
		},
	};
}
