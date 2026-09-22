import {
	ImageProviderAuthError,
	ImageProviderRequestError,
	ImageProviderUnsupportedError,
} from './tti_errors';
import { fetchImageAsBase64, poll, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

const BFL_BASE_URL = 'https://api.bfl.ai/v1';
const BFL_ENDPOINTS: Record<string, string> = {
	'FLUX.2': 'flux-2-pro',
	'FLUX.1 Kontext [pro]': 'flux-kontext-pro',
	'FLUX1.1 [pro] Ultra': 'flux-pro-1.1-ultra',
};

type BflSubmitResponse = { id?: string; polling_url?: string };
type BflResultResponse = { status?: string; result?: { sample?: string } };

export function createBflImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? BFL_BASE_URL;
	const headers = { 'x-key': spec.apiKey, 'Content-Type': 'application/json' };

	return {
		supportsSource: true,
		async generate(request) {
			const endpoint = BFL_ENDPOINTS[request.modelId] ?? request.modelId;
			if (request.source && endpoint !== 'flux-kontext-pro') {
				throw new ImageProviderUnsupportedError(
					`${request.modelId} does not support source-image editing.`
				);
			}
			const submitted = await requestJson<BflSubmitResponse>(spec.name, `${baseURL}/${endpoint}`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					prompt: request.prompt,
					...request.options,
					...(request.source ? { input_image: request.source.base64 } : {}),
				}),
				signal: request.signal,
			});
			const pollingUrl =
				submitted.polling_url ?? `${baseURL}/get_result?id=${encodeURIComponent(submitted.id ?? '')}`;

			const sample = await poll(spec.name, 120, 2000, async () => {
				const result = await requestJson<BflResultResponse>(spec.name, pollingUrl, {
					headers: { 'x-key': spec.apiKey },
					signal: request.signal,
				});
				if (result.status === 'Ready') {
					if (!result.result?.sample) {
						throw new ImageProviderRequestError(`${spec.name}: result contained no image.`);
					}
					return result.result.sample;
				}
				if (result.status === 'Error' || result.status === 'Failed') {
					throw new ImageProviderRequestError(`${spec.name}: generation failed.`);
				}
				return undefined;
			});
			return fetchImageAsBase64(sample, request.signal);
		},
	};
}
