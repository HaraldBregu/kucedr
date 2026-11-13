import { generateTaskMedia } from '../task/generation';
import { ImageProviderAuthError, ImageProviderRequestError } from './tti_errors';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function createJwtImageAdapter(spec: ImageProviderSpec, imageList: boolean): ImageAdapter {
	return {
		async generate(request) {
			return generateKlingMedia(
				spec,
				request.endpoint ?? '/v1/images/generations',
				{
					...request.options,
					model_name: request.modelId,
					prompt: request.prompt,
					...(request.source
						? imageList
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
