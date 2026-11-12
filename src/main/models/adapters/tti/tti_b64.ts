import OpenAI from 'openai';
import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { detectMimeType, fetchImageAsBase64 } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function createB64ImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const client = new OpenAI({ apiKey: spec.apiKey, baseURL: spec.baseURL });

	return {
		async generate(request) {
			let response: OpenAI.Images.ImagesResponse;
			try {
				response = await client.images.generate(
					{
						model: request.modelId,
						prompt: request.prompt,
						response_format: 'b64_json',
						...request.options,
					},
					{ signal: request.signal }
				);
			} catch (error) {
				const status = (error as { status?: number }).status ?? 0;
				const message = (error as Error).message ?? String(error);
				if (status === 401 || status === 403) throw new ImageProviderAuthError(message);
				throw error;
			}
			const image = response.data?.[0];
			if (image?.b64_json) {
				return { base64: image.b64_json, mimeType: detectMimeType(image.b64_json) };
			}
			if (image?.url) return fetchImageAsBase64(image.url, request.signal);
			throw new ImageProviderRequestError(`${spec.name}: response contained no image.`);
		},
	};
}
