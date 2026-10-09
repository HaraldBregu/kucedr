import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

export function createZaiVideoAdapter(provider: VideoProviderSpec): VideoAdapter {
	if (!provider.apiKey)
		throw new VideoProviderAuthError(`${provider.name} API key not configured.`);
	const baseURL = provider.baseURL ?? 'https://api.z.ai/api/paas/v4';
	const headers = {
		Authorization: `Bearer ${provider.apiKey}`,
		'Content-Type': 'application/json',
	};
	return {
		async generate(request) {
			const task = await requestJson<{ id?: string }>(
				provider.name,
				`${baseURL}/videos/generations`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({
						...request.options,
						model: request.modelId,
						prompt: request.prompt,
					}),
					signal: request.signal,
				}
			);
			if (!task.id)
				throw new VideoProviderRequestError(`${provider.name}: generation was not accepted.`);
			const url = await poll(provider.name, 120, 5000, async () => {
				const result = await requestJson<{
					task_status?: string;
					video_result?: { url?: string }[];
				}>(provider.name, `${baseURL}/async-result/${task.id}`, {
					headers,
					signal: request.signal,
				});
				if (result.task_status === 'FAIL')
					throw new VideoProviderRequestError(`${provider.name}: generation failed.`);
				if (result.task_status !== 'SUCCESS') return undefined;
				const videoUrl = result.video_result?.[0]?.url;
				if (!videoUrl)
					throw new VideoProviderRequestError(`${provider.name}: result contained no video.`);
				return videoUrl;
			});
			return fetchVideoAsBase64(url, request.signal);
		},
	};
}
