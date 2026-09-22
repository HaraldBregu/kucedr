export const TEXT_TO_SPEECH_MAX_TEXT_LENGTH = 20_000;
export const TEXT_TO_SPEECH_AUDIO_FORMATS = ['mp3', 'wav', 'opus', 'pcm'] as const;

export type TextToSpeechAudioFormat = (typeof TEXT_TO_SPEECH_AUDIO_FORMATS)[number];

export interface TextToSpeechSynthesisRequest {
	text: string;
	voiceId?: string;
	format?: TextToSpeechAudioFormat;
}

export interface TextToSpeechAudioOutput {
	data: string;
	encoding: 'base64';
	mimeType: string;
	byteLength: number;
}

export interface TextToSpeechSynthesisMetadata {
	providerId: string;
	providerName: string;
	modelId: string;
	modelName: string;
	format: TextToSpeechAudioFormat;
	voiceId?: string;
	createdAt: string;
}

export interface TextToSpeechSynthesisResult {
	audio: TextToSpeechAudioOutput;
	metadata: TextToSpeechSynthesisMetadata;
}

export function normalizeTextToSpeechSynthesisRequest(
	request: TextToSpeechSynthesisRequest | string
): TextToSpeechSynthesisRequest {
	const source = typeof request === 'string' ? { text: request } : request;
	if (!source || typeof source !== 'object' || Array.isArray(source)) {
		throw new Error('Invalid text-to-speech synthesis request.');
	}

	if (typeof source.text !== 'string') {
		throw new Error('Text-to-speech text must be a string.');
	}

	const text = source.text.trim();
	if (!text) throw new Error('Text-to-speech text is required.');
	if (text.length > TEXT_TO_SPEECH_MAX_TEXT_LENGTH) {
		throw new Error('Text-to-speech text is too long.');
	}

	const voiceId =
		typeof source.voiceId === 'string' && source.voiceId.trim()
			? source.voiceId.trim()
			: undefined;
	const format = source.format;
	if (format !== undefined && !TEXT_TO_SPEECH_AUDIO_FORMATS.includes(format)) {
		throw new Error(`Unsupported text-to-speech audio format: ${String(format)}`);
	}

	return {
		text,
		...(voiceId ? { voiceId } : {}),
		...(format ? { format } : {}),
	};
}
