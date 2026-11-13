import { requestInteraction } from '../interactions/interaction';
import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

export function createInteractionsVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) throw new VideoProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async generate(request) {
			const { media, ...options } = request.options ?? {};
			const content = await requestInteraction(
				spec,
				{
					...options,
					model: request.modelId,
					input: Array.isArray(media)
						? [...media, { type: 'text', text: request.prompt }]
						: request.prompt,
				},
				{ auth: VideoProviderAuthError, request: VideoProviderRequestError },
				request.signal
			);
			const video = content.filter((part) => part.type === 'video' && part.data).at(-1);
			if (!video?.data)
				throw new VideoProviderRequestError(`${spec.name}: response contained no video.`);
			return { base64: video.data, mimeType: video.mime_type ?? 'video/mp4' };
		},
	};
}
