import { createContentImageAdapter } from './tti_content';
import { createFormImageAdapter } from './tti_form';
import { createGenerationsImageAdapter } from './tti_generations';
import { createImageGenerationAdapter } from './tti_imagegen';
import { createImagesAdapter } from './tti_images';
import { createJwtImageAdapter } from './tti_jwt';
import { createKeyedImageAdapter } from './tti_keyed';
import { createMultimodalImageAdapter } from './tti_multimodal';
import { createPollingImageAdapter } from './tti_polling';
import { createSdkImageAdapter } from './tti_sdk';
import { createUrlImageAdapter } from './tti_url';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export const IMAGE_PROTOCOLS: Readonly<Record<string, (spec: ImageProviderSpec) => ImageAdapter>> =
	{
		images: createImagesAdapter,
		'images-sdk': createSdkImageAdapter,
		'images-url': createUrlImageAdapter,
		'generate-content': createContentImageAdapter,
		'polling-url': (spec) => createPollingImageAdapter(spec, false),
		'polling-url-references': (spec) => createPollingImageAdapter(spec, true),
		'api-key': (spec) => createKeyedImageAdapter(spec, false),
		'image-request': (spec) => createKeyedImageAdapter(spec, true),
		'jwt-task': (spec) => createJwtImageAdapter(spec, false),
		'jwt-task-image-list': (spec) => createJwtImageAdapter(spec, true),
		'image-generation': createImageGenerationAdapter,
		generations: createGenerationsImageAdapter,
		'multimodal-generation': createMultimodalImageAdapter,
		'form-image': createFormImageAdapter,
	};
