import crypto from 'node:crypto';
import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

type JwtTask = {
	data?: {
		task_id?: string;
		task_status?: string;
		task_status_msg?: string;
		task_result?: { videos?: Array<{ url?: string }> };
	};
};

export function createJwtVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	const [accessKey, secretKey] = spec.apiKey.split(':');
	if (!spec.apiKey) {
		throw new VideoProviderAuthError(
			`${spec.name} requires the API key in "accessKey:secretKey" format.`
		);
	}
	const baseURL = spec.baseURL;
	const buildHeaders = (): Record<string, string> => {
		const now = Math.floor(Date.now() / 1000);
		const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
		const payload = Buffer.from(
			JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 })
		).toString('base64url');
		const signature = crypto
			.createHmac('sha256', secretKey)
			.update(`${header}.${payload}`)
			.digest('base64url');
		return {
			Authorization: `Bearer ${header}.${payload}.${signature}`,
			'Content-Type': 'application/json',
		};
	};

	return {
		async generate(request) {
			if (!accessKey || !secretKey)
				throw new VideoProviderAuthError(
					`${spec.name} requires the API key in "accessKey:secretKey" format for this model.`
				);
			const path = request.endpoint ?? '/v1/videos/text2video';
			const submitted = await requestJson<JwtTask>(spec.name, `${baseURL}${path}`, {
				method: 'POST',
				headers: buildHeaders(),
				body: JSON.stringify({
					model_name: request.modelId,
					prompt: request.prompt,
					...request.options,
				}),
				signal: request.signal,
			});
			const taskId = submitted.data?.task_id;
			if (!taskId) {
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const videoUrl = await poll(spec.name, 120, 5000, request.signal, async () => {
				const task = await requestJson<JwtTask>(spec.name, `${baseURL}${path}/${taskId}`, {
					headers: buildHeaders(),
					signal: request.signal,
				});
				if (task.data?.task_status === 'succeed') {
					const url = task.data.task_result?.videos?.[0]?.url;
					if (!url) {
						throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
					}
					return url;
				}
				if (task.data?.task_status === 'failed') {
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed. ${task.data.task_status_msg ?? ''}`.trim()
					);
				}
				return undefined;
			});
			return fetchVideoAsBase64(videoUrl, request.signal);
		},
	};
}
