import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

type BflTask = { id?: string; polling_url?: string; status?: string; result?: { sample?: string } };

export function createBflVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? 'https://api.bfl.ai/v1';
	const headers = { 'x-key': spec.apiKey, 'Content-Type': 'application/json' };
	return {
		async generate(request) {
			const task = await requestJson<BflTask>(spec.name, `${baseURL}/${request.modelId}`, {
				method: 'POST',
				headers,
				signal: request.signal,
				body: JSON.stringify({ mode: 't2v', ...request.options, prompt: request.prompt }),
			});
			if (!task.polling_url)
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			const url = await poll(spec.name, 180, 5000, async () => {
				const status = await requestJson<BflTask>(spec.name, task.polling_url!, {
					headers,
					signal: request.signal,
				});
				if (status.status === 'Ready') {
					if (!status.result?.sample)
						throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					return status.result.sample;
				}
				if (
					['Error', 'Failed', 'Request Moderated', 'Content Moderated'].includes(
						status.status ?? ''
					)
				) {
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed (${status.status}).`
					);
				}
				return undefined;
			});
			return fetchVideoAsBase64(url, request.signal);
		},
	};
}
