import { Mistral } from '@mistralai/mistralai';
import { speechResult } from './tts_audio';
import { SpeechProviderRequestError } from './tts_errors';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const MISTRAL_AUDIO_TYPES: Readonly<Record<string, string>> = {
	pcm: 'audio/pcm',
	wav: 'audio/wav',
	mp3: 'audio/mpeg',
	flac: 'audio/flac',
	opus: 'audio/opus',
};

export function createCompleteSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	const client = new Mistral({
		apiKey: provider.apiKey,
		serverURL: provider.baseURL.replace(/\/v1\/?$/, ''),
	});
	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			const options = request.options ?? {};
			const optionVoiceId = options.voice_id;
			const refAudio = typeof options.ref_audio === 'string' ? options.ref_audio : undefined;
			const voiceId =
				request.voice ??
				(typeof optionVoiceId === 'string' ? optionVoiceId : undefined) ??
				(refAudio ? undefined : (await client.audio.voices.list({ limit: 1 })).items[0]?.id);
			if (!voiceId && !refAudio) {
				throw new SpeechProviderRequestError(
					`${provider.name}: no voice available. Create a voice with the provider before synthesizing speech.`
				);
			}
			const responseFormat =
				typeof options.response_format === 'string' ? options.response_format : 'mp3';
			const response = await client.audio.speech.complete({
				model: request.modelId,
				input: request.text,
				voiceId,
				refAudio,
				responseFormat: responseFormat as 'pcm' | 'wav' | 'mp3' | 'flac' | 'opus',
				promptCacheKey:
					typeof options.prompt_cache_key === 'string' ? options.prompt_cache_key : undefined,
				metadata:
					options.metadata &&
					typeof options.metadata === 'object' &&
					!Array.isArray(options.metadata)
						? (options.metadata as Record<string, unknown>)
						: undefined,
				stream: false,
			});
			return speechResult(
				response.audioData,
				MISTRAL_AUDIO_TYPES[responseFormat] ?? 'application/octet-stream',
				provider,
				request
			);
		},
	};
}
