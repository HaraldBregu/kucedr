import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const PIKA_BASE_URL = 'https://fal.run';
const PIKA_ENDPOINTS: Record<string, string> = {
	'pika-2.2': 'fal-ai/pika/v2.2/text-to-video',
};

type PikaResponse = { video?: { url?: string } };
type PikaJob = { id?: string; status?: string; output?: { video?: { url?: string } }; error?: string | { message?: string } };

export function createPikaVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? PIKA_BASE_URL;

	return {
		async generate(request) {
			if (request.modelId === 'pika-2.5') {
				const directBaseURL = spec.baseURL && !spec.baseURL.includes('fal.run') ? spec.baseURL.replace(/\/v1\/?$/, '') : 'https://api.dev.pika.art';
				const headers = { 'X-API-Key': spec.apiKey, 'Content-Type': 'application/json' };
				const submitted = await requestJson<PikaJob>(spec.name, `${directBaseURL}/v1/media/pika/pika-2.5/text-to-video`, {
					method: 'POST', headers, signal: request.signal,
					body: JSON.stringify({ resolution: '720p', duration_s: 5, ...request.options, prompt: request.prompt }),
				});
				if (!submitted.id) throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
				const url = await poll(spec.name, 120, 5000, async () => {
					const job = await requestJson<PikaJob>(spec.name, `${directBaseURL}/v1/media/jobs/${encodeURIComponent(submitted.id!)}`, { headers, signal: request.signal });
					if (job.status === 'failed') throw new VideoProviderRequestError(`${spec.name}: generation failed. ${typeof job.error === 'string' ? job.error : job.error?.message ?? ''}`.trim());
					if (job.status !== 'completed') return undefined;
					if (!job.output?.video?.url) throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					return job.output.video.url;
				});
				return fetchVideoAsBase64(url, request.signal);
			}
			const endpoint = PIKA_ENDPOINTS[request.modelId] ?? PIKA_ENDPOINTS['pika-2.2'];
			const response = await requestJson<PikaResponse>(spec.name, `${baseURL}/${endpoint}`, {
				method: 'POST',
				headers: { Authorization: `Key ${spec.apiKey}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt: request.prompt, ...request.options }),
				signal: request.signal,
			});
			if (!response.video?.url) {
				throw new VideoProviderRequestError(`${spec.name}: response contained no video.`);
			}
			return fetchVideoAsBase64(response.video.url, request.signal);
		},
	};
}
