import type {
	RealtimeVoiceModelRef,
	RealtimeVoiceSetup,
	RealtimeVoiceSetupRequest,
} from '../../../shared/realtime_voice';
import type { CatalogModel } from '../../../shared/model_types';
import { normalizeProviderId } from '../../../shared/provider_types';
import { getVoiceModel, setVoiceModel } from '../agent_store';
import { findModel } from '../../models';
import {
	realtimeVoiceModelRefs,
	supportsRealtimeVoiceModel,
} from '../../models/adapters/realtime_voice';

function supportedModels(): RealtimeVoiceModelRef[] {
	const seen = new Set<string>();
	return realtimeVoiceModelRefs().flatMap((reference) => {
		const providerId = normalizeProviderId(reference.providerId);
		const modelId = reference.modelId.trim();
		const key = `${providerId}:${modelId}`;
		if (!providerId || !modelId || seen.has(key)) return [];
		if (!findModel(providerId, 'realtime-voice', modelId)) return [];
		seen.add(key);
		return [{ providerId, modelId }];
	});
}

function canonicalOptions(
	model: CatalogModel,
	options: Record<string, unknown>
): Record<string, unknown> {
	const next = { ...options };
	const voice =
		model.metadata?.documentationStatus === 'verified' ? model.metadata.inputs.voice : undefined;
	const choices = voice?.enum?.filter(
		(choice): choice is string => typeof choice === 'string' && choice.trim().length > 0
	);
	if (!choices?.length) {
		delete next.voice;
		return next;
	}
	const requested = typeof next.voice === 'string' ? next.voice.trim() : '';
	const fallback =
		typeof voice?.default === 'string' && choices.includes(voice.default)
			? voice.default
			: choices[0];
	next.voice = choices.includes(requested) ? requested : fallback;
	return next;
}

export function getRealtimeVoiceSetup(): RealtimeVoiceSetup {
	const available = supportedModels();
	const stored = getVoiceModel('realtimeVoice');
	const providerId = normalizeProviderId(stored.providerId);
	const modelId = stored.modelId.trim();
	const selected = available.some(
		(reference) => reference.providerId === providerId && reference.modelId === modelId
	);
	const model = selected ? findModel(providerId, 'realtime-voice', modelId) : undefined;
	return {
		...(model ? { providerId, modelId } : {}),
		options: model ? canonicalOptions(model, stored.options) : {},
		supportedModels: available,
	};
}

export function setRealtimeVoiceSetup(request: RealtimeVoiceSetupRequest): RealtimeVoiceSetup {
	if (!request || typeof request !== 'object' || Array.isArray(request)) {
		throw new Error('Invalid realtime voice setup.');
	}
	if (typeof request.providerId !== 'string' || typeof request.modelId !== 'string') {
		throw new Error('Invalid realtime voice provider or model.');
	}
	const providerId = normalizeProviderId(request.providerId);
	const modelId = request.modelId.trim();
	if (!providerId || !modelId) throw new Error('Invalid realtime voice provider or model.');
	if (!request.options || typeof request.options !== 'object' || Array.isArray(request.options)) {
		throw new Error('Invalid realtime voice options.');
	}
	if (!supportsRealtimeVoiceModel(providerId, modelId)) {
		throw new Error('This model does not support realtime voice conversations.');
	}
	const model = findModel(providerId, 'realtime-voice', modelId);
	if (!model) throw new Error('The selected realtime voice model is not available.');
	const options = canonicalOptions(model, request.options);
	setVoiceModel('realtimeVoice', { providerId, modelId, options });
	return { providerId, modelId, options, supportedModels: supportedModels() };
}
