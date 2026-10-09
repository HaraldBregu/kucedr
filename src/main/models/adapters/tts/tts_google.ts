import { ensureSpeechResponseOk, speechResult } from './tts_audio';
import { SpeechProviderRequestError } from './tts_errors';
import type { SpeechAdapter, SpeechAdapterRequest, SpeechProviderSpec } from './tts_types';
import type { SpeechSynthesisResult } from '../../../../shared/speech_types';

const GOOGLE_DEFAULT_VOICE = 'Kore';
const GOOGLE_DEFAULT_SAMPLE_RATE = 24_000;

type GoogleGenerateContentResponse = {
	candidates?: Array<{
		content?: {
			parts?: Array<{
				inlineData?: { mimeType?: string; data?: string };
			}>;
		};
	}>;
};

export function createGoogleSpeechAdapter(provider: SpeechProviderSpec): SpeechAdapter {
	const baseURL = provider.baseURL.replace(/\/openai\/?$/, '');

	return {
		async synthesize(request: SpeechAdapterRequest): Promise<SpeechSynthesisResult> {
			const optionVoiceName = request.options?.voiceName;
			const languageCode = request.options?.languageCode;
			const multiSpeakerVoiceConfig = request.options?.multiSpeakerVoiceConfig ?? request.options?.multiSpeakerVoiceConfig;
			const currentTts = request.modelId.startsWith('gemini-3.8-');
			const speechMetadata = request.options?.speechMetadata;
			const multiSpeaker =
				multiSpeakerVoiceConfig &&
				typeof multiSpeakerVoiceConfig === 'object' &&
				!Array.isArray(multiSpeakerVoiceConfig)
					? multiSpeakerVoiceConfig
					: undefined;
			const voiceName =
				request.voice ??
				(typeof optionVoiceName === 'string' ? optionVoiceName : GOOGLE_DEFAULT_VOICE);
			const response = await fetch(`${baseURL}/models/${request.modelId}:generateContent`, {
				method: 'POST',
				headers: {
					'x-goog-api-key': provider.apiKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					contents: [{ parts: [{ text: request.text, ...(currentTts && speechMetadata ? { speech_metadata: speechMetadata } : {}) }] }],
					generationConfig: {
						responseModalities: ['AUDIO'],
						speechConfig: {
							...(typeof languageCode === 'string' ? { languageCode } : {}),
							...(multiSpeaker
								? { multiSpeakerVoiceConfig: multiSpeaker }
								: {
										voiceConfig: {
											...(currentTts ? { voice: voiceName } : { prebuiltVoiceConfig: { voiceName } }),
										},
									}),
						},
					},
				}),
			});
			await ensureSpeechResponseOk(response, provider.name);

			const data = (await response.json()) as GoogleGenerateContentResponse;
			const inlineData = data.candidates?.[0]?.content?.parts?.find(
				(part) => part.inlineData?.data
			)?.inlineData;
			if (!inlineData?.data) {
				throw new SpeechProviderRequestError(`${provider.name}: response contained no audio.`);
			}

			const mimeType = inlineData.mimeType ?? '';
			if (!/pcm|l16/i.test(mimeType)) {
				return speechResult(inlineData.data, mimeType || 'audio/wav', provider, request);
			}
			const sampleRate = Number(/rate=(\d+)/.exec(mimeType)?.[1]) || GOOGLE_DEFAULT_SAMPLE_RATE;
			const wav = pcmToWav(Buffer.from(inlineData.data, 'base64'), sampleRate);
			return speechResult(wav.toString('base64'), 'audio/wav', provider, request);
		},
	};
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
	const header = Buffer.alloc(44);
	header.write('RIFF', 0);
	header.writeUInt32LE(36 + pcm.length, 4);
	header.write('WAVE', 8);
	header.write('fmt ', 12);
	header.writeUInt32LE(16, 16);
	header.writeUInt16LE(1, 20);
	header.writeUInt16LE(1, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(sampleRate * 2, 28);
	header.writeUInt16LE(2, 32);
	header.writeUInt16LE(16, 34);
	header.write('data', 36);
	header.writeUInt32LE(pcm.length, 40);
	return Buffer.concat([header, pcm]);
}
