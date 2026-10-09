import { generatePikaMedia } from '../pika/generation';
import { speechResult } from './tts_audio';
import { SpeechProviderAuthError, SpeechProviderRequestError } from './tts_errors';
import type { SpeechAdapter, SpeechProviderSpec } from './tts_types';

export function createPikaSpeechAdapter(spec: SpeechProviderSpec): SpeechAdapter {
	if (!spec.apiKey) throw new SpeechProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async synthesize(request) {
			const media = await generatePikaMedia(
				spec,
				'pika/pika-audio/pika-speech',
				{
					...request.options,
					script: request.text,
					voice_preset:
						request.voice ?? request.options?.voice_preset ?? 'calm_documentary_narrator',
				},
				{ auth: SpeechProviderAuthError, request: SpeechProviderRequestError }
			);
			return speechResult(media.base64, media.mimeType, spec, request);
		},
	};
}
