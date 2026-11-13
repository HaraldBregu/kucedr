import { generateTaskMedia } from '../task/generation';
import { VideoProviderAuthError, VideoProviderRequestError } from './ttv_errors';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

export function createTaskVideoAdapter(spec: VideoProviderSpec): VideoAdapter {
	if (!spec.apiKey) {
		throw new VideoProviderAuthError(
			`${spec.name} requires the API key in "accessKey:secretKey" format.`
		);
	}
	return {
		async generate(request) {
			return generateTaskMedia(
				spec,
				request.endpoint ?? `/text-to-video/${request.modelId}`,
				{ ...request.options, prompt: request.prompt },
				'video',
				{ auth: VideoProviderAuthError, request: VideoProviderRequestError },
				request.signal
			);
		},
	};
}
