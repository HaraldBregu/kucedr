import { generatePikaMedia } from '../pika/generation';
import { MusicProviderAuthError, MusicProviderRequestError } from './tta_errors';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

export function createPikaMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async generate(request) {
			return generatePikaMedia(
				spec,
				`pika/pika-audio/${request.modelId}`,
				{ ...request.options, prompt: request.prompt },
				{ auth: MusicProviderAuthError, request: MusicProviderRequestError },
				request.signal
			);
		},
	};
}
