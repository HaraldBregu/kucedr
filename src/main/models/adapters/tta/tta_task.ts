import { generateTaskMedia } from '../task/generation';
import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function createTaskMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	return {
		async generate(request) {
			return generateTaskMedia(
				spec,
				request.endpoint ?? '/v1/audio/text-to-audio',
				{ ...request.options, prompt: request.prompt },
				'audio',
				{ auth: MusicProviderAuthError, request: MusicProviderRequestError },
				request.signal
			);
		},
	};
}
