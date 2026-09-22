import crypto from 'node:crypto';
import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const KLING_BASE_URL = 'https://api-singapore.klingai.com';

type KlingTask = {
	data?: {
		task_id?: string;
		task_status?: string;
		task_status_msg?: string;
		task_result?: { videos?: Array<{ url?: string }> };
	};
};

function base64Url(input: string | Buffer): string {
	return Buffer.from(input).toString('base64url');
}

function signJwt(accessKey: string, secretKey: string): string {
	const now = Math.floor(Date.now() / 1000);
	const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64Url(JSON.stringify({ iss: accessKey, exp: now + 1800, nbf: now - 5 }));
	const signature = crypto
		.createHmac('sha256', secretKey)
		.update(`${header}.${payload}`)
		.digest('base64url');
	return `${header}.${payload}.${signature}`;
}

export function createKlingVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	// ponytail: Kling needs an access/secret pair; the single stored key uses "accessKey:secretKey".
	const [accessKey, secretKey] = spec.apiKey.split(':');
	if (!accessKey || !secretKey) {
		throw new VideoProviderAuthError(
			`${spec.name} requires the API key in "accessKey:secretKey" format.`
		);
	}
	const baseURL = spec.baseURL ?? KLING_BASE_URL;
	const buildHeaders = (): Record<string, string> => ({
		Authorization: `Bearer ${signJwt(accessKey, secretKey)}`,
		'Content-Type': 'application/json',
	});

	return {
		async generate(request) {
			const submitted = await requestJson<KlingTask>(spec.name, `${baseURL}/v1/videos/text2video`, {
				method: 'POST',
				headers: buildHeaders(),
				body: JSON.stringify({ model_name: request.modelId, prompt: request.prompt, ...request.options }),
				signal: request.signal,
			});
			const taskId = submitted.data?.task_id;
			if (!taskId) {
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const videoUrl = await poll(spec.name, 120, 5000, async () => {
				const task = await requestJson<KlingTask>(
					spec.name,
					`${baseURL}/v1/videos/text2video/${taskId}`,
					{ headers: buildHeaders(), signal: request.signal }
				);
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
