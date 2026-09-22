import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1';

type MinimaxTaskResponse = {
	task_id?: string;
	status?: string;
	file_id?: string;
	base_resp?: { status_msg?: string };
};

type MinimaxFileResponse = {
	file?: { download_url?: string };
};

export function createMinimaxVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? MINIMAX_BASE_URL;
	const headers = { Authorization: `Bearer ${spec.apiKey}`, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const submitted = await requestJson<MinimaxTaskResponse>(
				spec.name,
				`${baseURL}/video_generation`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({ model: request.modelId, prompt: request.prompt, ...request.options }),
					signal: request.signal,
				}
			);
			if (!submitted.task_id) {
				throw new VideoProviderRequestError(
					`${spec.name}: generation was not accepted. ${submitted.base_resp?.status_msg ?? ''}`.trim()
				);
			}

			const fileId = await poll(spec.name, 120, 5000, async () => {
				const task = await requestJson<MinimaxTaskResponse>(
					spec.name,
					`${baseURL}/query/video_generation?task_id=${submitted.task_id}`,
					{ headers, signal: request.signal }
				);
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

			const file = await requestJson<MinimaxFileResponse>(
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
