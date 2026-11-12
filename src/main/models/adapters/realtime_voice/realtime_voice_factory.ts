import { createBetaRealtimeVoiceAdapter } from './beta';
import { createBidiVoiceAdapter } from './bidi';
import { FlatRealtimeVoiceAdapter } from './flat';
import { LiveVoiceAdapter } from './live';
import { RealtimeSessionVoiceAdapter } from './realtime';
import type {
	RealtimeVoiceAdapter,
	RealtimeVoiceModelSpec,
	RealtimeVoiceProviderSpec,
} from './realtime_voice_types';

export interface RealtimeVoiceProtocol {
	readonly tools: boolean;
	create(provider: RealtimeVoiceProviderSpec, model: RealtimeVoiceModelSpec): RealtimeVoiceAdapter;
}

const PROTOCOLS: Readonly<Record<string, RealtimeVoiceProtocol>> = {
	realtime: {
		tools: true,
		create: (provider, model) => new RealtimeSessionVoiceAdapter(provider, model),
	},
	'realtime-flat': {
		tools: true,
		create: (provider, model) => new FlatRealtimeVoiceAdapter(provider, model),
	},
	'realtime-beta': { tools: true, create: createBetaRealtimeVoiceAdapter },
	live: { tools: false, create: (provider, model) => new LiveVoiceAdapter(provider, model) },
	bidi: { tools: true, create: createBidiVoiceAdapter },
};

export function realtimeVoiceProtocol(
	model: RealtimeVoiceModelSpec,
	providerName: string
): RealtimeVoiceProtocol {
	const protocol = model.metadata?.protocol;
	if (!protocol || !Object.hasOwn(PROTOCOLS, protocol))
		throw new Error(`${model.name} (${providerName}) declares no supported protocol.`);
	return PROTOCOLS[protocol];
}

export function buildRealtimeVoiceAdapter(
	provider: RealtimeVoiceProviderSpec,
	model: RealtimeVoiceModelSpec
): RealtimeVoiceAdapter {
	return realtimeVoiceProtocol(model, provider.name).create(provider, model);
}
