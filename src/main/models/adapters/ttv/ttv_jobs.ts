import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

type Job = {
	id?: string;
	status?: string;
	output?: { video?: { url?: string } };
	error?: string | { message?: string };
};

export function createJobsVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL.replace(/\/v1\/?$/, '');
	const headers = { 'X-API-Key': spec.apiKey, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const submitted = await requestJson<Job>(
				spec.name,
				`${baseURL}/v1/media/${request.endpoint ?? request.modelId}`,
				{
					method: 'POST',
					headers,
					signal: request.signal,
					body: JSON.stringify({
						resolution: '720p',
						duration_s: 5,
						...request.options,
						prompt: request.prompt,
					}),
				}
			);
			if (!submitted.id)
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			const url = await poll(spec.name, 120, 5000, async () => {
				const job = await requestJson<Job>(
					spec.name,
					`${baseURL}/v1/media/jobs/${encodeURIComponent(submitted.id!)}`,
					{ headers, signal: request.signal }
				);
				if (job.status === 'failed')
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed. ${typeof job.error === 'string' ? job.error : (job.error?.message ?? '')}`.trim()
					);
				if (job.status !== 'completed') return undefined;
				if (!job.output?.video?.url)
					throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
				return job.output.video.url;
			});
			return fetchVideoAsBase64(url, request.signal);
		},
	};
}
