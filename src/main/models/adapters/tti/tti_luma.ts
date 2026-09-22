import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { fetchImageAsBase64, poll, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

const LUMA_BASE_URL = 'https://api.lumalabs.ai/dream-machine/v1';

type LumaGeneration = {
	id?: string;
	state?: string;
	failure_reason?: string;
	assets?: { image?: string };
};

export function createLumaImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? LUMA_BASE_URL;
	const headers = { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const submitted = await requestJson<LumaGeneration>(
				spec.name,
				`${baseURL}/generations/image`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({ prompt: request.prompt, model: request.modelId, ...request.options }),
					signal: request.signal,
				}
			);
			if (!submitted.id) {
				throw new ImageProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const imageUrl = await poll(spec.name, 120, 2000, async () => {
				const generation = await requestJson<LumaGeneration>(
					spec.name,
					`${baseURL}/generations/${submitted.id}`,
					{ headers, signal: request.signal }
				);
				if (generation.state === 'completed') {
					if (!generation.assets?.image) {
						throw new ImageProviderRequestError(`${spec.name}: result contained no image.`);
					}
					return generation.assets.image;
				}
				if (generation.state === 'failed') {
					throw new ImageProviderRequestError(
						`${spec.name}: generation failed. ${generation.failure_reason ?? ''}`.trim()
					);
				}
				return undefined;
			});
			return fetchImageAsBase64(imageUrl, request.signal);
		},
	};
}
