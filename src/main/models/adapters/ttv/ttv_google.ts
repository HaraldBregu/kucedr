import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

type GoogleOperation = {
	name?: string;
	done?: boolean;
	error?: { message?: string };
	response?: {
		generateVideoResponse?: {
			generatedSamples?: Array<{ video?: { uri?: string } }>;
		};
	};
};

export function createGoogleVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? GOOGLE_BASE_URL;
	const headers = { 'x-goog-api-key': spec.apiKey, 'Content-Type': 'application/json' };

	return {
		async generate(request) {
			const operation = await requestJson<GoogleOperation>(
				spec.name,
				`${baseURL}/models/${request.modelId}:predictLongRunning`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({
						instances: [{ prompt: request.prompt }],
						...(request.options ? { parameters: request.options } : {}),
					}),
					signal: request.signal,
				}
			);
			if (!operation.name) {
				throw new VideoProviderRequestError(`${spec.name}: generation was not accepted.`);
			}

			const videoUri = await poll(spec.name, 120, 5000, async () => {
				const status = await requestJson<GoogleOperation>(
					spec.name,
					`${baseURL}/${operation.name}`,
					{ headers, signal: request.signal }
				);
				if (!status.done) return undefined;
				if (status.error) {
					throw new VideoProviderRequestError(
						`${spec.name}: generation failed. ${status.error.message ?? ''}`.trim()
					);
				}
				const uri =
					status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
				if (!uri) {
					throw new VideoProviderRequestError(`${spec.name}: result contained no video.`);
				}
				return uri;
			});
			return fetchVideoAsBase64(videoUri, request.signal, { 'x-goog-api-key': spec.apiKey });
		},
	};
}
