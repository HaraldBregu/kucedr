import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

type PollingTask = {
	id?: string;
	polling_url?: string;
	status?: string;
	result?: { sample?: string };
};

export function createPollingVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL;
	const headers = { 'x-key': spec.apiKey, 'Content-Type': 'application/json' };
	return {
		async generate(request) {
			const task = await requestJson<PollingTask>(
				spec.name,
				`${baseURL}/${request.endpoint ?? request.modelId}`,
				{
					method: 'POST',
					headers,
					signal: request.signal,
					body: JSON.stringify({ mode: 't2v', ...request.options, prompt: request.prompt }),
				}
			);
			if (!task.polling_url)
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			const url = await poll(spec.name, 180, 5000, request.signal, async () => {
				const status = await requestJson<PollingTask>(spec.name, task.polling_url!, {
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
