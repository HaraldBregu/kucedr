import { generateKlingMedia } from '../kling/generation';
import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function createKlingImageAdapter(spec: ImageProviderSpec): ImageAdapter {
	return {
		supportsSource: true,
		async generate(request) {
			const omni = request.modelId === 'kling-v3-omni' || request.modelId === 'kling-image-o1';
			return generateKlingMedia(
				spec,
				omni ? '/v1/images/omni-image' : '/v1/images/generations',
				{
					...request.options,
					model_name: request.modelId,
					prompt: request.prompt,
					...(request.source
						? omni
							? { image_list: [{ image: request.source.base64 }] }
							: { image: request.source.base64 }
						: {}),
				},
				'image',
				{ auth: ImageProviderAuthError, request: ImageProviderRequestError },
				request.signal
			);
		},
	};
}
