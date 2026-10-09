import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { fetchImageAsBase64, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

type MiniMaxImage = {
	data?: { image_urls?: string[] };
	base_resp?: { status_code?: number; status_msg?: string };
};

export function createMiniMaxImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	return {
		supportsSource: true,
		async generate(request) {
			const response = await requestJson<MiniMaxImage>(
				spec.name,
				`${spec.baseURL ?? 'https://api.minimax.io/v1'}/image_generation`,
				{
					method: 'POST',
					signal: request.signal,
					headers: { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						...request.options,
						model: request.modelId,
						prompt: request.prompt,
						response_format: 'url',
						...(request.source
							? {
									subject_reference: [
										{
											type: 'character',
											image_file: `data:${request.source.mimeType};base64,${request.source.base64}`,
										},
									],
								}
							: {}),
					}),
				}
			);
			if (response.base_resp?.status_code || !response.data?.image_urls?.[0])
				throw new ImageProviderRequestError(
					`${spec.name}: ${response.base_resp?.status_msg ?? 'response contained no image'}`
				);
			return fetchImageAsBase64(response.data.image_urls[0], request.signal);
		},
	};
}
