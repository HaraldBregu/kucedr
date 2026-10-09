import { ImageProviderAuthError, ImageProviderRequestError, ImageProviderUnsupportedError } from './tti_errors';
import { fetchImageAsBase64, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

const IDEOGRAM_BASE_URL = 'https://api.ideogram.ai';
const IDEOGRAM_LEGACY_MODELS: Record<string, string> = { 'ideogram-2a': 'V_2A' };
const IDEOGRAM_ENDPOINTS: Record<string, string> = {
	'ideogram-4.5': '/v2/image/generate/ideogram-4-5',
	'ideogram-4.0': '/v1/ideogram-v4/generate',
	'p-image-ideogram': '/v1/text-to-image/p-image-ideogram',
};

type IdeogramResponse = { data?: Array<{ url?: string }> };

export function createIdeogramImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? IDEOGRAM_BASE_URL;
	const headers = { 'Api-Key': spec.apiKey, 'Content-Type': 'application/json' };

	return {
		supportsSource: true,
		async generate(request) {
			if (request.source && request.modelId !== 'ideogram-4.5') {
				throw new ImageProviderUnsupportedError(`${request.modelId} does not support source-image editing.`);
			}
			const options = request.options ?? {};
			const payload = { [request.modelId === 'ideogram-4.0' ? 'text_prompt' : 'prompt']: request.prompt, ...options };
			const form = request.source ? new FormData() : undefined;
			if (form && request.source) {
				for (const [key, value] of Object.entries(payload)) {
					if (value !== undefined) form.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
				}
				form.append('images', new Blob([Buffer.from(request.source.base64, 'base64')], { type: request.source.mimeType }), 'source.png');
			}
			const legacyModel = IDEOGRAM_LEGACY_MODELS[request.modelId];
			const response = legacyModel
				? await requestJson<IdeogramResponse>(spec.name, `${baseURL}/generate`, {
						method: 'POST',
						headers,
						body: JSON.stringify({
							image_request: { prompt: request.prompt, model: legacyModel, ...request.options },
						}),
						signal: request.signal,
					})
				: await requestJson<IdeogramResponse>(spec.name, `${baseURL}${IDEOGRAM_ENDPOINTS[request.modelId] ?? '/v1/ideogram-v3/generate'}`, {
						method: 'POST',
						headers: form ? { 'Api-Key': spec.apiKey } : headers,
						body: form ?? JSON.stringify(payload),
						signal: request.signal,
					});
			const url = response.data?.[0]?.url;
			if (!url) throw new ImageProviderRequestError(`${spec.name}: response contained no image.`);
			return fetchImageAsBase64(url, request.signal);
		},
	};
}
