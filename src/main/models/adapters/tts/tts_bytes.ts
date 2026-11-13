import { ensureSpeechResponseOk, responseAudioToBase64, speechResult } from './tts_audio';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const BYTES_PATH = 'tts/bytes';
const BYTES_VERSION = '2026-03-01';
const BYTES_FLAT_VERSION = '2026-08-14';
const BYTES_FLAT_PROTOCOL = 'tts-bytes-2026-08-14';

export function createBytesSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	const flat = provider.protocol === BYTES_FLAT_PROTOCOL;
	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			const {
				voice: optionVoice,
				output_format: optionOutputFormat,
				model_id: _modelId,
				transcript: _transcript,
				...options
			} = request.options ?? {};
			const selectedVoice =
				request.voice ??
				(typeof optionVoice === 'string' ? optionVoice : undefined) ??
				(optionVoice && typeof optionVoice === 'object' && !Array.isArray(optionVoice)
					? (optionVoice as Record<string, unknown>).id
					: undefined);
			const voiceId =
				typeof selectedVoice === 'string'
					? selectedVoice
					: inputDefault(request.metadata, ['voice']);
			const selectedOutputFormat =
				optionOutputFormat &&
				typeof optionOutputFormat === 'object' &&
				!Array.isArray(optionOutputFormat)
					? (optionOutputFormat as Record<string, unknown>)
					: {};
			const container =
				typeof selectedOutputFormat.container === 'string' ? selectedOutputFormat.container : 'mp3';
			const outputFormat =
				container === 'mp3'
					? {
							container,
							sample_rate: selectedOutputFormat.sample_rate ?? 44_100,
							bit_rate: selectedOutputFormat.bit_rate ?? 128_000,
						}
					: {
							container,
							encoding: selectedOutputFormat.encoding ?? 'pcm_s16le',
							sample_rate: selectedOutputFormat.sample_rate ?? 44_100,
						};
			const response = await fetch(new URL(BYTES_PATH, `${provider.baseURL}/`), {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${provider.apiKey}`,
					'Cartesia-Version': flat ? BYTES_FLAT_VERSION : BYTES_VERSION,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model_id: request.modelId,
					transcript: request.text,
					voice: flat ? voiceId : { mode: 'id', id: voiceId },
					...options,
					output_format: outputFormat,
				}),
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
