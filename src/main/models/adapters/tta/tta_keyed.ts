import { MusicProviderAuthError } from './tta_errors';
import { requestAudio } from './tta_shared';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

const KEYED_API_KEY_HEADER = 'xi-api-key';
const KEYED_SOUND_PROTOCOL = 'sound-generation';

export function createKeyedMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);

	return {
		generate(request) {
			const sound = spec.protocol === KEYED_SOUND_PROTOCOL;
			const {
				output_format: outputFormat,
				enable_logging: enableLogging,
				...options
			} = request.options ?? {};
			const endpoint = new URL(`${spec.baseURL}/${sound ? 'sound-generation' : 'music'}`);
			if (typeof outputFormat === 'string')
				endpoint.searchParams.set('output_format', outputFormat);
			if (typeof enableLogging === 'boolean')
				endpoint.searchParams.set('enable_logging', String(enableLogging));
			return requestAudio(spec.name, endpoint.toString(), {
				method: 'POST',
				headers: {
					[KEYED_API_KEY_HEADER]: spec.apiKey,
					Accept: 'audio/mpeg',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					[sound ? 'text' : 'prompt']: request.prompt,
					...options,
					model_id: request.modelId,
				}),
				signal: request.signal,
			});
		},
	};
}
