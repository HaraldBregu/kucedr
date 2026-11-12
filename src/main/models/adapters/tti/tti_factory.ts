import { IMAGE_PROTOCOLS } from './tti_protocols';
import { ImageProviderUnsupportedError } from './tti_errors';
import type { ImageAdapter, ImageProviderSpec } from './tti_types';

export function buildImageAdapter(
	protocol: string | undefined,
	modelName: string,
	spec: ImageProviderSpec
): ImageAdapter {
	const create =
		protocol && Object.hasOwn(IMAGE_PROTOCOLS, protocol) ? IMAGE_PROTOCOLS[protocol] : undefined;
	if (!create) {
		throw new ImageProviderUnsupportedError(
			`${modelName} (${spec.name}) declares no supported protocol.`
		);
	}
	return create(spec);
}
