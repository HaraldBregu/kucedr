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
			const soundEffects = request.modelId === 'elevenlabs-sound-effects';
			return requestAudio(
				spec.name,
				`${baseURL}/${soundEffects ? 'sound-generation' : 'music'}`,
				{
					method: 'POST',
					headers: {
						[ELEVENLABS_API_KEY_HEADER]: spec.apiKey,
						Accept: 'audio/mpeg',
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(
						soundEffects
							? { text: request.prompt, ...request.options }
							: { prompt: request.prompt, ...request.options }
					),
					signal: request.signal,
				}
			);
		},
	};
}
