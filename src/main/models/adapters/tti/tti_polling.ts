import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import { fetchImageAsBase64, poll, requestJson } from './tti_shared';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

type SubmitResponse = { id?: string; polling_url?: string };
type ResultResponse = { status?: string; result?: { sample?: string } };

export function createPollingImageAdapter(
	spec: ImageProviderSpec,
	references: boolean
): ImageAdapter {
	if (!spec.apiKey) throw new ImageProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL;
	const headers = { 'x-key': spec.apiKey, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const endpoint = request.endpoint ?? request.modelId;
			const submitted = await requestJson<SubmitResponse>(spec.name, `${baseURL}/${endpoint}`, {
				method: 'POST',
				headers,
				body: JSON.stringify({
					prompt: request.prompt,
					...request.options,
					...(request.source
						? references
							? {
									images: [request.source.base64, ...((request.options?.images as string[]) ?? [])],
								}
							: { input_image: request.source.base64 }
						: {}),
				}),
				signal: request.signal,
			});
			const pollingUrl =
				submitted.polling_url ??
				`${baseURL}/get_result?id=${encodeURIComponent(submitted.id ?? '')}`;

			const sample = await poll(spec.name, 120, 2000, async () => {
				const result = await requestJson<ResultResponse>(spec.name, pollingUrl, {
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
