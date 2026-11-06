import { MusicProviderAuthError } from './tta_errors';
import { requestAudio } from './tta_shared';
import type { MusicAdapter, MusicProviderSpec } from './tta_types';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const ELEVENLABS_API_KEY_HEADER = 'xi-api-key';

export function createElevenLabsMusicAdapter(spec: MusicProviderSpec): MusicAdapter {
	if (!spec.apiKey) throw new MusicProviderAuthError(`${spec.name} API key not configured.`);
	const baseURL = spec.baseURL ?? ELEVENLABS_BASE_URL;

	return {
		generate(request) {
			const soundEffects = [
				'elevenlabs-sound-effects',
				'eleven_text_to_sound_v2',
				'eleven_text_to_sound_v3',
			].includes(request.modelId);
			const {
				output_format: outputFormat,
				enable_logging: enableLogging,
				...options
			} = request.options ?? {};
			const endpoint = new URL(`${baseURL}/${soundEffects ? 'sound-generation' : 'music'}`);
			if (typeof outputFormat === 'string')
				endpoint.searchParams.set('output_format', outputFormat);
			if (typeof enableLogging === 'boolean')
				endpoint.searchParams.set('enable_logging', String(enableLogging));
			return requestAudio(spec.name, endpoint.toString(), {
				method: 'POST',
				headers: {
					[ELEVENLABS_API_KEY_HEADER]: spec.apiKey,
					Accept: 'audio/mpeg',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(
					soundEffects
						? {
								text: request.prompt,
								...options,
								model_id:
									request.modelId === 'elevenlabs-sound-effects'
										? 'eleven_text_to_sound_v2'
										: request.modelId,
							}
						: {
								prompt: request.prompt,
								...options,
								model_id: request.modelId === 'eleven-music' ? 'music_v1' : request.modelId,
							}
				),
				signal: request.signal,
			});
		},
	};
}
