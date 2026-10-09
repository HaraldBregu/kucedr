import { synthesizeDialogue } from './dialogue';
import { ensureSpeechResponseOk, responseAudioToBase64, speechResult } from './tts_audio';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const ELEVENLABS_TTS_PATH = 'text-to-speech';
const ELEVENLABS_API_KEY_HEADER = 'xi-api-key';
const ELEVENLABS_DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

export function createElevenLabsSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			if (['eleven_v4_turbo', 'eleven_v3_conversational'].includes(request.modelId))
				return synthesizeDialogue(provider, request);
			const {
				voice_id: optionVoiceId,
				output_format: outputFormat,
				enable_logging: enableLogging,
				optimize_streaming_latency: optimizeStreamingLatency,
				...bodyOptions
			} = request.options ?? {};
			const voiceId =
				request.voice ??
				(typeof optionVoiceId === 'string' ? optionVoiceId : ELEVENLABS_DEFAULT_VOICE_ID);
			const dialogue = request.modelId === 'eleven_v4';
			const endpoint = new URL(
				dialogue ? 'text-to-dialogue' : `${ELEVENLABS_TTS_PATH}/${voiceId}`,
				`${provider.baseURL}/`
			);
			if (typeof outputFormat === 'string')
				endpoint.searchParams.set('output_format', outputFormat);
			if (typeof enableLogging === 'boolean') {
				endpoint.searchParams.set('enable_logging', String(enableLogging));
			}
			if (typeof optimizeStreamingLatency === 'number') {
				endpoint.searchParams.set('optimize_streaming_latency', String(optimizeStreamingLatency));
			}
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					[ELEVENLABS_API_KEY_HEADER]: provider.apiKey,
					Accept: 'audio/mpeg',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					...(dialogue
						? { inputs: [{ text: request.text, voice_id: voiceId }] }
						: { text: request.text }),
					model_id: request.modelId,
					...bodyOptions,
				}),
			});
			await ensureSpeechResponseOk(response, provider.name);
			return speechResult(
				await responseAudioToBase64(response),
				response.headers.get('content-type')?.split(';')[0] || 'audio/mpeg',
				provider,
				request
			);
		},
	};
}
