import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const XAI_BASE_URL = 'https://api.x.ai/v1';

type XaiVideoResponse = {
	request_id?: string;
	status?: string;
	error?: string;
	video?: { url?: string };
};

export function createXaiVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? XAI_BASE_URL;
	const headers = { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const submitted = await requestJson<XaiVideoResponse>(
				spec.name,
				`${baseURL}/videos/generations`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({ model: request.modelId, prompt: request.prompt, ...request.options }),
					signal: request.signal,
				}
			);
			if (!submitted.request_id) {
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const videoUrl = await poll(spec.name, 120, 5000, async () => {
				const status = await requestJson<XaiVideoResponse>(
					spec.name,
					`${baseURL}/videos/${submitted.request_id}`,
					{ headers, signal: request.signal }
				);
				if (status.status === 'done') {
					if (!status.video?.url) {
						throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					}
					return status.video.url;
				}
				if (status.status === 'failed' || status.status === 'expired') {
					throw new VideoProviderRequestError(
						`${spec.name}: generation ${status.status}. ${status.error ?? ''}`.trim()
					);
				}
				return undefined;
			});
			return fetchVideoAsBase64(videoUrl, request.signal);
		},
	};
}
