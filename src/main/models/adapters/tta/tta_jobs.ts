import { generateJobMedia } from '../jobs/generation';
import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function createJobsMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async generate(request) {
			if (!request.endpoint)
				throw new MusicProviderRequestError(`${spec.name}: the model declares no endpoint.`);
			return generateJobMedia(
				spec,
				request.endpoint,
				{ ...request.options, prompt: request.prompt },
				{ auth: MusicProviderAuthError, request: MusicProviderRequestError },
				request.signal
			);
		},
	};
}
