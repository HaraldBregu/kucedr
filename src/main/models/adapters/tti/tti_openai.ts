import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { detectMimeType, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function createOpenAIImageAdapter(provider: ImageProviderSpec): ImageAdapter {
	if (!provider.apiKey)
		throw new ImageProviderAuthError(`${provider.name} API key not configured.`);
	return {
		supportsSource: true,
		async generate(request) {
			const parameters = {
				...request.options,
				model: request.modelId,
				prompt: request.prompt,
				n: 1,
			};
			const headers: Record<string, string> = { Authorization: `Bearer ${provider.apiKey}` };
			let body: BodyInit;
			if (request.source) {
				const form = new FormData();
				for (const [key, value] of Object.entries(parameters)) {
					if (value !== undefined) form.append(key, String(value));
				}
				form.append(
					'image',
					new Blob([new Uint8Array(Buffer.from(request.source.base64, 'base64'))], {
						type: request.source.mimeType,
					}),
					`source.${request.source.mimeType.split('/')[1]}`
				);
				body = form;
			} else {
				headers['Content-Type'] = 'application/json';
				body = JSON.stringify(parameters);
			}
			const response = await requestJson<{ data?: { b64_json?: string }[] }>(
				provider.name,
				new URL(
					request.source ? 'images/edits' : 'images/generations',
					`${provider.baseURL ?? 'https://api.openai.com/v1'}/`
				).toString(),
				{ method: 'POST', headers, body, signal: request.signal }
			);
			const base64 = response.data?.[0]?.b64_json;
			if (!base64)
				throw new ImageProviderRequestError(`${provider.name}: response contained no image.`);
			return { base64, mimeType: detectMimeType(base64) };
		},
	};
}
