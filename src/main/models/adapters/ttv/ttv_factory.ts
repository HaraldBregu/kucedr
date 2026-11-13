import { VIDEO_PROTOCOLS } from './ttv_protocols';
import { VideoProviderUnsupportedError } from './ttv_errors';
import type { VideoAdapter, VideoProviderSpec } from './ttv_types';

export function buildVideoAdapter(
	protocol: string | undefined,
	modelName: string,
	spec: VideoProviderSpec
): VideoAdapter {
	const create =
		protocol && Object.hasOwn(VIDEO_PROTOCOLS, protocol) ? VIDEO_PROTOCOLS[protocol] : undefined;
	if (!create) {
		throw new VideoProviderUnsupportedError(
			`${modelName} (${spec.name}) declares no supported protocol.`
		);
	}
	return create(spec);
}
