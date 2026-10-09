import { generateKlingMedia } from '../kling/generation';
import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function createKlingMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	return {
		async generate(request) {
			return generateKlingMedia(
				spec,
				'/v1/audio/text-to-audio',
				{ duration: 5, ...request.options, prompt: request.prompt },
				'audio',
				{ auth: MusicProviderAuthError, request: MusicProviderRequestError },
				request.signal
			);
		},
	};
}
