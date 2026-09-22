import { normalizeProviderId } from '../../../../shared/provider_types';
import { createDeepgramSttAdapter } from './stt_deepgram';
import { createElevenLabsSttAdapter } from './stt_elevenlabs';
import { createMistralSttAdapter } from './stt_mistral';
import { createOpenAISttAdapter } from './stt_openai';
import { createQwenSttAdapter } from './stt_qwen';
import { createXaiSttAdapter } from './stt_xai';
import { SttProviderUnsupportedError } from './stt_errors';
import type { SttAdapter, SttProviderSpec } from './stt_types';

const STT_ADAPTERS: Readonly<
	Record<string, (spec: SttProviderSpec) => SttAdapter>
> = {
	deepgram: createDeepgramSttAdapter,
	elevenlabs: createElevenLabsSttAdapter,
	mistral: createMistralSttAdapter,
	openai: createOpenAISttAdapter,
	qwen: createQwenSttAdapter,
	xai: createXaiSttAdapter,
};

export function buildSttAdapter(provider: SttProviderSpec): SttAdapter {
	const id = normalizeProviderId(provider.id);
	const create = STT_ADAPTERS[id];
	if (!create) {
		throw new SttProviderUnsupportedError(`Speech-to-text provider is not supported: ${id}`);
	}
	return create({ ...provider, id });
}
