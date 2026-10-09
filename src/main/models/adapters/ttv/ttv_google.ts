import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import { fetchVideoAsBase64, poll, requestJson } from './ttv_shared';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';
import { requestGoogleInteraction } from '../google/interaction';

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
			if (request.modelId === 'gemini-omni-1.1-flash') {
				const { media, ...options } = request.options ?? {};
				const content = await requestGoogleInteraction(spec, {
					...options, model: request.modelId,
					input: Array.isArray(media) ? [...media, { type: 'text', text: request.prompt }] : request.prompt,
				}, { auth: VideoProviderAuthError, request: VideoProviderRequestError }, request.signal);
				const video = content.filter((part) => part.type === 'video' && part.data).at(-1);
				if (!video?.data) throw new VideoProviderRequestError(`${spec.name}: response contained no video.`);
				return { base64: video.data, mimeType: video.mime_type ?? 'video/mp4' };
			}
			const modelId = { 'veo-3.1': 'veo-3.1-generate-preview', 'veo-3.1-fast': 'veo-3.1-fast-generate-preview' }[request.modelId] ?? request.modelId;
			const { image, lastFrame, referenceImages, video, ...parameters } = request.options ?? {};
			const operation = await requestJson<GoogleOperation>(
				spec.name,
				`${baseURL}/models/${modelId}:predictLongRunning`,
				{
					method: 'POST',
					headers,
					body: JSON.stringify({
						instances: [{ prompt: request.prompt, ...(image ? { image } : {}), ...(lastFrame ? { lastFrame } : {}), ...(referenceImages ? { referenceImages } : {}), ...(video ? { video } : {}) }],
						parameters,
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
