import { generateKlingMedia } from '../kling/generation';
import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function createKlingImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	return {
		supportsSource: true,
		async generate(request) {
			return generateKlingMedia(spec, '/v1/images/generations', { ...request.options, model_name: request.modelId, prompt: request.prompt, ...(request.source ? { image: request.source.base64 } : {}) }, 'image', { auth: ImageProviderAuthError, request: ImageProviderRequestError }, request.signal);
		},
	};
}
