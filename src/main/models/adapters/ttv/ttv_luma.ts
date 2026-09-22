import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const LUMA_BASE_URL = 'https://api.lumalabs.ai/dream-machine/v1';

type LumaGeneration = {
	id?: string;
	state?: string;
	failure_reason?: string;
	assets?: { video?: string };
};

export function createLumaVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? LUMA_BASE_URL;
	const headers = { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const submitted = await requestJson<LumaGeneration>(spec.name, `${baseURL}/generations`, {
				method: 'POST',
				headers,
				body: JSON.stringify({ prompt: request.prompt, model: request.modelId, ...request.options }),
				signal: request.signal,
			});
			if (!submitted.id) {
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const videoUrl = await poll(spec.name, 120, 5000, async () => {
				const generation = await requestJson<LumaGeneration>(
					spec.name,
					`${baseURL}/generations/${submitted.id}`,
					{ headers, signal: request.signal }
				);
				if (generation.state === 'completed') {
					if (!generation.assets?.video) {
						throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					}
					return generation.assets.video;
				}
				if (generation.state === 'failed') {
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed. ${generation.failure_reason ?? ''}`.trim()
					);
				}
				return undefined;
			});
			return fetchVideoAsBase64(videoUrl, request.signal);
		},
	};
}
