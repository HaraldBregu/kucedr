import { generateJobMedia } from '../jobs/generation';
import { inputDefault } from './defaults';
import { speechResult } from './tts_audio';
import { SpeechProviderAuthError, SpeechProviderRequestError } from './tts_errors';
import type { SpeechAdapter, SpeechProviderSpec } from './tts_types';

export function createJobsSpeechAdapter(spec: SpeechProviderSpec): SpeechAdapter {
	if (!spec.apiKey) throw new SpeechProviderAuthError(`${spec.name} API key not configured.`);
	return {
		async synthesize(request) {
			const endpoint = request.metadata?.endpoint;
			if (!endpoint)
				throw new SpeechProviderRequestError(`${spec.name}: the model declares no endpoint.`);
			const media = await generateJobMedia(
				spec,
				endpoint.replaceAll('{model}', request.metadata?.apiModelId ?? request.modelId),
				{
					...request.options,
					script: request.text,
					voice_preset:
						request.voice ??
						request.options?.voice_preset ??
						inputDefault(request.metadata, ['voice_preset']),
				},
				{ auth: SpeechProviderAuthError, request: SpeechProviderRequestError }
			);
			return speechResult(media.base64, media.mimeType, spec, request);
		},
	};
}
