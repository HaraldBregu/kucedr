import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

type SyncResponse = { video?: { url?: string } };

export function createSyncVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);

	return {
		async generate(request) {
			const response = await requestJson<SyncResponse>(
				spec.name,
				`${spec.baseURL}/${request.endpoint ?? request.modelId}`,
				{
					method: 'POST',
					headers: { Authorization: `Key ${spec.apiKey}`, 'Content-Type': 'application/json' },
					body: JSON.stringify({ prompt: request.prompt, ...request.options }),
					signal: request.signal,
				}
			);
			if (!response.video?.url) {
				throw new VideoProviderRequestError(`${spec.name}: response contained no video.`);
			}
			return fetchVideoAsBase64(response.video.url, request.signal);
		},
	};
}
