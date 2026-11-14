import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

type TaskResponse = {
	task_id?: string;
	status?: string;
	file_id?: string;
	base_resp?: { status_msg?: string };
	task?: { status?: string; content?: { url?: string }; error?: { message?: string } };
};

type FileResponse = {
	file?: { download_url?: string };
};

export function createVideoGenerationAdapter(
	spec: VideoProviderSpec,
	contentParts: boolean
): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL;
	const headers = { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const { content, ...options } = request.options ?? {};
			const submitted = await requestJson<TaskResponse>(spec.name, `${baseURL}/video_generation`, {
				method: 'POST',
				headers,
				body: JSON.stringify(
					contentParts
						? {
								model: request.modelId,
								resolution: '768P',
								duration: 5,
								ratio: '16:9',
								...options,
								content: [
									{ type: 'text', text: request.prompt },
									...(Array.isArray(content)
										? content.filter((item) => item?.type !== 'text')
										: []),
								],
							}
						: { model: request.modelId, prompt: request.prompt, ...request.options }
				),
				signal: request.signal,
			});
			if (!submitted.task_id) {
				throw new VideoProviderRequestError(
					`${spec.name}: generation was not accepted. ${submitted.base_resp?.status_msg ?? ''}`.trim()
				);
			}

			const fileId = await poll(spec.name, 120, 5000, request.signal, async () => {
				const task = await requestJson<TaskResponse>(
					spec.name,
					contentParts
						? `${baseURL}/query/video_generation/${encodeURIComponent(submitted.task_id!)}`
						: `${baseURL}/query/video_generation?task_id=${submitted.task_id}`,
					{ headers, signal: request.signal }
				);
				if (contentParts) {
					if (task.task?.status === 'succeeded') {
						if (!task.task.content?.url)
							throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
						return task.task.content.url;
					}
					if (['failed', 'cancelled'].includes(task.task?.status ?? ''))
						throw new VideoProviderRequestError(
							`${spec.name}: generation failed. ${task.task?.error?.message ?? ''}`.trim()
						);
					return undefined;
				}
				if (task.status === 'Success') {
					if (!task.file_id) {
						throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					}
					return task.file_id;
				}
				if (task.status === 'Fail') {
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed. ${task.base_resp?.status_msg ?? ''}`.trim()
					);
				}
				return undefined;
			});
			if (contentParts) return fetchVideoAsBase64(fileId, request.signal);

			const file = await requestJson<FileResponse>(
				spec.name,
				`${baseURL}/files/retrieve?file_id=${fileId}`,
				{ headers, signal: request.signal }
			);
			if (!file.file?.download_url) {
				throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
			}
			return fetchVideoAsBase64(file.file.download_url, request.signal);
		},
	};
}
