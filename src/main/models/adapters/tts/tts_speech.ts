import { ensureSpeechResponseOk, responseAudioToBase64, speechResult } from './tts_audio';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const SPEECH_PATH = 'audio/speech';
const SPEECH_AUDIO_TYPES: Readonly<Record<string, string>> = {
	mp3: 'audio/mpeg',
	opus: 'audio/opus',
	aac: 'audio/aac',
	flac: 'audio/flac',
	wav: 'audio/wav',
	pcm: 'audio/pcm',
};

export function createOpenAISpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			const options = request.options ?? {};
			const customVoiceId = options.custom_voice_id;
			const responseFormat =
				typeof options.response_format === 'string' ? options.response_format : 'mp3';
			const voice =
				request.voice ??
				(typeof customVoiceId === 'string' ? { id: customVoiceId } : undefined) ??
				(typeof options.voice === 'string' ||
				(options.voice && typeof options.voice === 'object' && !Array.isArray(options.voice))
					? options.voice
					: OPENAI_DEFAULT_VOICE);
			const response = await fetch(new URL(OPENAI_TTS_PATH, `${provider.baseURL}/`), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${provider.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: request.modelId,
					input: request.text,
					voice,
					...(typeof options.instructions === 'string'
						? { instructions: options.instructions }
						: {}),
					...(typeof options.speed === 'number' ? { speed: options.speed } : {}),
					response_format: responseFormat,
					stream_format: 'audio',
				}),
			});
			await ensureSpeechResponseOk(response, provider.name);
			return speechResult(
				await responseAudioToBase64(response),
				response.headers.get('content-type')?.split(';')[0] ||
					OPENAI_AUDIO_TYPES[responseFormat] ||
					'application/octet-stream',
				provider,
				request
			);
		},
	};
}
