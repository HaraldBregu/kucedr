import { normalizeProviderId } from '../../../../shared/provider_types';
import { OPENAI_VOICE_MODELS, OpenAIRealtimeVoiceAdapter } from './realtime_voice_openai';
import type { RealtimeVoiceAdapter, RealtimeVoiceProviderSpec } from './realtime_voice_types';
import { XAI_REALTIME_VOICE_MODELS, XAIRealtimeVoiceAdapter } from './realtime_voice_xai';

interface RealtimeVoiceAdapterRegistration {
	readonly defaultVoice: string;
	readonly modelIds: readonly string[];
	create(provider: RealtimeVoiceProviderSpec): RealtimeVoiceAdapter;
}

const REALTIME_VOICE_ADAPTERS: Readonly<Record<string, RealtimeVoiceAdapterRegistration>> = {
	openai: {
		defaultVoice: 'marin',
		modelIds: OPENAI_VOICE_MODELS,
		create: (provider) => new OpenAIRealtimeVoiceAdapter(provider),
	},
	xai: {
		defaultVoice: 'eve',
		modelIds: XAI_REALTIME_VOICE_MODELS,
		create: (provider) => new XAIRealtimeVoiceAdapter(provider),
	},
};

const REALTIME_VOICE_MODEL_REFS = Object.freeze(
	Object.entries(REALTIME_VOICE_ADAPTERS).flatMap(([providerId, registration]) =>
		registration.modelIds.map((modelId) => Object.freeze({ providerId, modelId }))
	)
);

export function buildRealtimeVoiceAdapter(
	provider: RealtimeVoiceProviderSpec
): RealtimeVoiceAdapter {
	const id = normalizeProviderId(provider.id);
	const registration = REALTIME_VOICE_ADAPTERS[id];
	if (!registration) throw new Error(`Realtime voice provider is not supported: ${id}`);
	return registration.create({ ...provider, id });
}

export function realtimeVoiceModelRefs(): readonly {
	providerId: string;
	modelId: string;
}[] {
	return REALTIME_VOICE_MODEL_REFS;
}

export function supportsRealtimeVoiceModel(providerId: string, modelId: string): boolean {
	const registration = REALTIME_VOICE_ADAPTERS[normalizeProviderId(providerId)];
	return registration?.modelIds.includes(modelId.trim()) ?? false;
}

export function realtimeVoiceDefaultVoice(providerId: string): string | undefined {
	return REALTIME_VOICE_ADAPTERS[normalizeProviderId(providerId)]?.defaultVoice;
}
