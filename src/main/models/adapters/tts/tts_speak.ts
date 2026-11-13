import { ensureSpeechResponseOk, responseAudioToBase64, speechResult } from './tts_audio';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const SPEAK_PATH = 'speak';
const SPEAK_QUERY_OPTIONS = [
	'encoding',
	'sample_rate',
	'container',
	'bit_rate',
	'callback',
	'callback_method',
	'mip_opt_out',
	'speed',
] as const;

export function createDeepgramSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			const endpoint = new URL(DEEPGRAM_TTS_PATH, `${provider.baseURL}/`);
			const optionVoice = request.options?.voice;
			endpoint.searchParams.set(
				'model',
				request.voice ?? (typeof optionVoice === 'string' ? optionVoice : DEEPGRAM_DEFAULT_VOICE)
			);
			for (const key of DEEPGRAM_QUERY_OPTIONS) {
				const value = request.options?.[key];
				if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
					endpoint.searchParams.set(key, String(value));
				}
			}
			const tags = request.options?.tag;
			for (const tag of Array.isArray(tags) ? tags : [tags]) {
				if (typeof tag === 'string') endpoint.searchParams.append('tag', tag);
			}
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					Authorization: `Token ${provider.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ text: request.text }),
			});
			await ensureSpeechResponseOk(response, provider.name);
			return speechResult(
				await responseAudioToBase64(response),
				response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream',
				provider,
				request
			);
		},
	};
}
