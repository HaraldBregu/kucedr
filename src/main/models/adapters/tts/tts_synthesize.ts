import { normalizeProviderId } from '../../../../shared/provider_types';
import {
	normalizeSpeechSynthesisRequest,
	type SpeechSynthesisRequest,
	type SpeechSynthesisResult,
} from '../../../../shared/speech_types';
import {
	defaultProviderId,
	loadProviders,
	providerModels,
	supportsCapability,
} from '../../../models';
import { getProvider } from '../../../settings_store';
import { buildSpeechAdapter } from './tts_factory';
import { SpeechProviderAuthError, SpeechProviderUnsupportedError } from './tts_errors';
import { getModelId, getProviderId, resolveOptions } from '../../selection';
import type { SpeechProviderSpec } from './tts_types';

export async function synthesize(
	request: SpeechSynthesisRequest,
	selection: 'chatbot' | 'tool' = 'chatbot'
): Promise<SpeechSynthesisResult> {
	const normalized = normalizeSpeechSynthesisRequest(request);
	const providerId = resolveProviderId(
		normalized.providerId ?? configuredProviderId() ?? defaultProviderId('text-to-speech') ?? ''
	);
	const modelId = resolveModelId(providerId, normalized.modelId ?? configuredModelId(providerId));
	const provider = resolveProvider(providerId);
	return buildSpeechAdapter(provider).synthesize({
		...normalized,
		providerId,
		modelId,
		options:
			selection === 'tool'
				? normalized.options
				: resolveOptions('voice', providerId, modelId, normalized.options),
	});
}

function resolveProviderId(providerId: string): string {
	const normalized = normalizeProviderId(providerId);
	if (supportsCapability(normalized, 'text-to-speech')) {
		return normalized;
	}
	throw new SpeechProviderUnsupportedError(
		`Text-to-speech provider is not supported: ${normalized}`
	);
}

function resolveModelId(providerId: string, modelId: string | undefined): string {
	const models = providerModels(providerId, 'text-to-speech');
	if (!modelId) return models[0].id;
	const normalized = modelId.trim();
	if (!models.some((model) => model.id === normalized)) {
		throw new SpeechProviderUnsupportedError(
			`Text-to-speech model is not supported: ${providerId}/${normalized}`
		);
	}
	return normalized;
}

function configuredProviderId(): string | undefined {
	const stored = getProviderId('voice');
	if (!stored) return undefined;
	const normalized = normalizeProviderId(stored);
	return supportsCapability(normalized, 'text-to-speech') ? normalized : undefined;
}

function configuredModelId(providerId: string): string | undefined {
	if (configuredProviderId() !== providerId) return undefined;
	const modelId = getModelId('voice');
	return modelId &&
		providerModels(providerId, 'text-to-speech').some((model) => model.id === modelId)
		? modelId
		: undefined;
}

function resolveProvider(providerId: string): SpeechProviderSpec {
	const stored = getProvider(providerId);
	const defaults = loadProviders().find((provider) => provider.id === providerId);
	const spec: SpeechProviderSpec = {
		id: providerId,
		name: stored?.name || defaults?.name || providerId,
		apiKey: stored?.apiKey.trim() ?? '',
		baseURL: stored?.baseUrl || defaults?.baseUrl || '',
	};
	if (!spec.apiKey) {
		throw new SpeechProviderAuthError(`${spec.name} API key not configured.`);
	}
	return spec;
}
