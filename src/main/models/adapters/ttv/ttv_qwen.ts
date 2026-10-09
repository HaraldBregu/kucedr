import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const QWEN_BASE_URL = 'https://dashscope-intl.aliyuncs.com/api/v1';

type QwenTask = {
	output?: {
		task_id?: string;
		task_status?: string;
		message?: string;
		video_url?: string;
	};
};

export function createQwenVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? QWEN_BASE_URL;
	const headers = { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const { media, ...parameters } = request.options ?? {};
			const submitted = await requestJson<QwenTask>(
				spec.name,
				`${baseURL}/services/aigc/video-generation/video-synthesis`,
				{
					method: 'POST',
					headers: { ...headers, 'X-DashScope-Async': 'enable' },
					body: JSON.stringify({
						model: request.modelId,
						input: { prompt: request.prompt, ...(media ? { media } : {}) },
						parameters,
					}),
					signal: request.signal,
				}
			);
			const taskId = submitted.output?.task_id;
			if (!taskId) {
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const videoUrl = await poll(spec.name, 120, 5000, async () => {
				const task = await requestJson<QwenTask>(spec.name, `${baseURL}/tasks/${taskId}`, {
					headers,
					signal: request.signal,
				});
				if (task.output?.task_status === 'SUCCEEDED') {
					if (!task.output.video_url) {
						throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					}
					return task.output.video_url;
				}
				if (task.output?.task_status === 'FAILED') {
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed. ${task.output.message ?? ''}`.trim()
					);
				}
				return undefined;
			});
			return fetchVideoAsBase64(videoUrl, request.signal);
		},
	};
}
