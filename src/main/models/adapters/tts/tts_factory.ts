import { createBytesSpeechAdapter } from './tts_bytes';
import { createCompleteSpeechAdapter } from './tts_complete';
import { createContentSpeechAdapter } from './tts_content';
import { createJobsSpeechAdapter } from './tts_jobs';
import { createPlainSpeechAdapter } from './tts_plain';
import { createSpeakSpeechAdapter } from './tts_speak';
import { createAudioSpeechAdapter } from './tts_speech';
import { createSynthesizerSpeechAdapter } from './tts_synthesizer';
import { createT2aSpeechAdapter } from './tts_t2a';
import { createVoiceSpeechAdapter } from './tts_voice';
import { SpeechProviderUnsupportedError } from './tts_errors';
import type { SpeechAdapter, SpeechProviderSpec } from './tts_types';

const TTS_PROTOCOLS: Readonly<Record<string, (spec: SpeechProviderSpec) => SpeechAdapter>> = {
	'audio-speech': createAudioSpeechAdapter,
	'text-to-speech': createVoiceSpeechAdapter,
	'text-to-dialogue': createVoiceSpeechAdapter,
	'text-to-dialogue-stream': createVoiceSpeechAdapter,
	tts: createPlainSpeechAdapter,
	'tts-bytes': createBytesSpeechAdapter,
	'tts-bytes-2026-08-14': createBytesSpeechAdapter,
	speak: createSpeakSpeechAdapter,
	'generate-content': createContentSpeechAdapter,
	'generate-content-voice': createContentSpeechAdapter,
	t2a: createT2aSpeechAdapter,
	jobs: createJobsSpeechAdapter,
	'speech-complete': createCompleteSpeechAdapter,
	'speech-synthesizer': createSynthesizerSpeechAdapter,
};

export function buildSpeechAdapter(provider: SpeechProviderSpec, modelName: string): SpeechAdapter {
	const create =
		provider.protocol && Object.hasOwn(TTS_PROTOCOLS, provider.protocol)
			? TTS_PROTOCOLS[provider.protocol]
			: undefined;
	if (!create) {
		throw new SpeechProviderUnsupportedError(
			`${modelName} (${provider.name}) declares no supported protocol.`
		);
	}
	return create(provider);
}
