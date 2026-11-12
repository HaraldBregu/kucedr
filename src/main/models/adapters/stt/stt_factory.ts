import { createPaasSttAdapter } from './stt_paas';
import { createWebsocketSttAdapter } from './stt_websocket';
import { createFormSttAdapter } from './stt_form';
import { createListenSttAdapter } from './stt_listen';
import { createElevenLabsSttAdapter as createSpeechSttAdapter } from './stt_speech';
import { createInteractionsSttAdapter } from './stt_interactions';
import { createMistralSttAdapter as createStreamSttAdapter } from './stt_stream';
import { createHeaderSttAdapter } from './stt_header';
import { createTranscriptionsSttAdapter } from './stt_transcriptions';
import { createGenerationSttAdapter } from './stt_generation';
import { createDuplexSttAdapter } from './stt_duplex';
import { createSessionSttAdapter } from './stt_session';
import { createXaiSttAdapter as createPlainSttAdapter } from './stt_plain';
import { SttProviderUnsupportedError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

const STT_PROTOCOLS: Readonly<Record<string, (spec: SttProviderSpec) => SttAdapter>> = {
	transcriptions: createTranscriptionsSttAdapter,
	'transcriptions-intent': createTranscriptionsSttAdapter,
	'transcriptions-form': createFormSttAdapter,
	'transcription-stream': createStreamSttAdapter,
	'transcription-session': createSessionSttAdapter,
	listen: createListenSttAdapter,
	'listen-v2': createListenSttAdapter,
	'speech-to-text': createSpeechSttAdapter,
	'speech-to-text-header': createHeaderSttAdapter,
	stt: createPlainSttAdapter,
	'stt-websocket': createWebsocketSttAdapter,
	interactions: createInteractionsSttAdapter,
	'paas-transcriptions': createPaasSttAdapter,
	'multimodal-generation': createGenerationSttAdapter,
	'duplex-asr': createDuplexSttAdapter,
};

export function buildSttAdapter(provider: SttProviderSpec, modelName: string): SttAdapter {
	const create = provider.protocol ? STT_PROTOCOLS[provider.protocol] : undefined;
	if (!create) {
		throw new SttProviderUnsupportedError(
			`${modelName} (${provider.name}) declares no supported protocol.`
		);
	}
	return create(provider);
}
