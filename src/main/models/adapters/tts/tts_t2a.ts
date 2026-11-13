import { ensureSpeechResponseOk, speechResult } from './tts_audio';
import { SpeechProviderAuthError, SpeechProviderRequestError } from './tts_errors';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const MINIMAX_TTS_PATH = 't2a_v2';
const MINIMAX_DEFAULT_VOICE_ID = 'English_expressive_narrator';
const MINIMAX_AUDIO_TYPES: Readonly<Record<string, string>> = {
	mp3: 'audio/mpeg',
	wav: 'audio/wav',
	flac: 'audio/flac',
	pcm: 'audio/pcm',
	pcmu_raw: 'audio/basic',
	pcmu_wav: 'audio/wav',
	opus: 'audio/opus',
};

type T2aResponse = {
	data?: { audio?: string };
	base_resp?: { status_code?: number; status_msg?: string };
};

export function createT2aSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			const {
				voice_id: optionVoiceId,
				voice_setting: optionVoiceSetting,
				audio_setting: optionAudioSetting,
				stream: _stream,
				stream_options: _streamOptions,
				output_format: _outputFormat,
				...options
			} = request.options ?? {};
			const voiceSetting =
				optionVoiceSetting &&
				typeof optionVoiceSetting === 'object' &&
				!Array.isArray(optionVoiceSetting)
					? (optionVoiceSetting as Record<string, unknown>)
					: {};
			const audioSetting =
				optionAudioSetting &&
				typeof optionAudioSetting === 'object' &&
				!Array.isArray(optionAudioSetting)
					? (optionAudioSetting as Record<string, unknown>)
					: {};
			const voiceId =
				request.voice ??
				(typeof voiceSetting.voice_id === 'string'
					? voiceSetting.voice_id
					: typeof optionVoiceId === 'string'
						? optionVoiceId
						: MINIMAX_DEFAULT_VOICE_ID);
			const audioFormat = typeof audioSetting.format === 'string' ? audioSetting.format : 'mp3';
			const response = await fetch(new URL(MINIMAX_TTS_PATH, `${provider.baseURL}/`), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${provider.apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: request.modelId,
					text: request.text,
					stream: false,
					output_format: 'hex',
					voice_setting: { ...voiceSetting, voice_id: voiceId },
					audio_setting: { ...audioSetting, format: audioFormat },
					...options,
				}),
			});
			await ensureSpeechResponseOk(response, provider.name);

			const data = (await response.json()) as T2aResponse;
			if (data.base_resp?.status_code === 1004) {
				throw new SpeechProviderAuthError(`${provider.name}: ${data.base_resp.status_msg}`);
			}
			if (data.base_resp?.status_code !== 0 || !data.data?.audio) {
				throw new SpeechProviderRequestError(
					`${provider.name}: ${data.base_resp?.status_msg ?? 'response contained no audio.'}`
				);
			}
			const audio = Buffer.from(data.data.audio, 'hex').toString('base64');
			return speechResult(
				audio,
				MINIMAX_AUDIO_TYPES[audioFormat] ?? 'application/octet-stream',
				provider,
				request
			);
		},
	};
}
