import { randomUUID } from 'node:crypto';
import type { SpeechToTextApiType } from '../../../../shared/model_types';
import type { PublicProvider } from '../../../../shared';
import {
	STT_DEFAULT_REALTIME_SAMPLE_RATE,
	normalizeSttRealtimeAudioChunk,
	normalizeSttRealtimeStartRequest,
	normalizeSttTranscriptionRequest,
	type SttRealtimeEvent,
	type SttRealtimeSession,
	type SttRealtimeStartRequest,
	type SttModelSelection,
	type SttSelectionMode,
	type SttTranscriptionRequest,
	type SttTranscriptionResult,
} from '../../../../shared/stt_transcription';
import { normalizeProviderId } from '../../../../shared/provider_types';
import type { ProviderModel } from '../../../../shared/model_types';
import { buildSttAdapter } from './stt_factory';
import { SttProviderAuthError, SttProviderUnsupportedError } from './stt_errors';
import type { SttActiveRealtimeSession, SttProviderSpec } from './stt_types';
import {
	loadProviders,
	providerIdsFor,
	providerModels,
	speechToTextApiTypes,
	speechToTextBaseUrl,
	speechToTextSampleRate,
	supportsCapability,
	supportsSpeechToTextApiType,
} from '../../../models';
import { getProvider } from '../../../settings_store';
import type { PublicProvider as CatalogProvider } from '../../../../shared/provider_types';
import {
	getModelId as getTranscribeModelId,
	getProviderId as getTranscribeProviderId,
	setSelection as setTranscribeSelection,
} from '../../selection';

const realtimeSessions = new Map<string, SttActiveRealtimeSession>();

export function getSelection(mode: SttSelectionMode = 'transcribe'): SttModelSelection | undefined {
	const configuredProviderId = getTranscribeProviderId(mode);
	const configuredModelId = getTranscribeModelId(mode);
	if (!configuredProviderId || !configuredModelId) return undefined;

	try {
		const providerId = resolveProviderId(configuredProviderId);
		const model = findSpeechToTextModel(providerId, configuredModelId);
		const provider = publicProvider(providerId);
		if (!provider || !model) return undefined;
		return { provider, model: { ...model } };
	} catch {
		return undefined;
	}
}

export function listProviders(): PublicProvider[] {
	return providerIdsFor('speech-to-text').flatMap((providerId) => {
		const provider = publicProvider(providerId);
		return provider ? [provider] : [];
	});
}

export function listModels(providerId: string): ProviderModel[] {
	const normalized = resolveProviderId(providerId);
	return providerModels(normalized, 'speech-to-text');
}

export function saveSelection(
	providerId: string,
	modelId: string,
	mode: SttSelectionMode = 'transcribe'
): boolean {
	const normalizedProviderId = resolveProviderId(providerId);
	const normalizedModelId = modelId.trim();
	const apiType = mode === 'realtime' ? 'stream' : 'batch';
	if (!supportsSpeechToTextApiType(normalizedProviderId, normalizedModelId, apiType)) {
		throw new SttProviderUnsupportedError(
			`Speech-to-text model does not support ${apiType} transcription: ${normalizedProviderId}/${normalizedModelId}`
		);
	}
	setTranscribeSelection(mode, normalizedProviderId, normalizedModelId);
	return true;
}

export async function transcribe(
	request: SttTranscriptionRequest
): Promise<SttTranscriptionResult> {
	const normalized = normalizeSttTranscriptionRequest(request);
	const providerId = resolveProviderId(
		normalized.providerId ?? getConfiguredProviderId('transcribe')
	);
	const modelId = resolveModelId(
		providerId,
		normalized.modelId ?? getConfiguredModelId(providerId, 'batch', 'transcribe'),
		'batch'
	);
	const model = findSpeechToTextModel(providerId, modelId)!;
	const provider = { ...resolveProvider(providerId), protocol: model.metadata?.protocol };
	const adapter = buildSttAdapter(provider, model.name);

	return adapter.transcribe({
		...normalized,
		providerId,
		modelId,
		metadata: model.metadata,
	});
}

export async function startRealtime(
	request: SttRealtimeStartRequest | undefined,
	onEvent: (event: SttRealtimeEvent) => void
): Promise<SttRealtimeSession> {
	const normalized = normalizeSttRealtimeStartRequest(request);
	const providerId = resolveProviderId(
		normalized.providerId ?? getConfiguredProviderId('realtime')
	);
	const modelId = resolveModelId(
		providerId,
		normalized.modelId ?? getConfiguredModelId(providerId, 'stream', 'realtime'),
		'stream'
	);
	const model = findSpeechToTextModel(providerId, modelId)!;
	const provider = { ...resolveProvider(providerId), protocol: model.metadata?.protocol };
	const adapter = buildSttAdapter(provider, model.name);
	if (!adapter.startRealtime) {
		throw new SttProviderUnsupportedError(
			`Speech-to-text provider does not support realtime transcription: ${providerId}`
		);
	}

	const session: SttRealtimeSession = {
		id: randomUUID(),
		providerId,
		providerName: provider.name,
		modelId,
		sampleRate: normalized.sampleRate ?? realtimeSampleRate(providerId),
		format: 'pcm16',
	};
	const emit = (event: SttRealtimeEvent): void => {
		if (event.type === 'closed') realtimeSessions.delete(event.sessionId);
		onEvent(event);
	};
	const connection = await adapter.startRealtime(
		{
			...normalized,
			sessionId: session.id,
			providerId,
			providerName: provider.name,
			modelId,
			metadata: model.metadata,
			sampleRate: session.sampleRate,
		},
		emit
	);
	realtimeSessions.set(session.id, { info: session, connection });
	emit({
		type: 'started',
		sessionId: session.id,
		providerId,
		model: modelId,
	});
	return session;
}

export async function appendRealtimeAudio(sessionId: string, audio: string): Promise<void> {
	const session = resolveRealtimeSession(sessionId);
	await session.connection.appendAudio(normalizeSttRealtimeAudioChunk(audio));
}

export async function finishRealtime(sessionId: string): Promise<void> {
	const session = resolveRealtimeSession(sessionId);
	await session.connection.finish();
}

export async function cancelRealtime(sessionId: string): Promise<void> {
	const session = resolveRealtimeSession(sessionId);
	realtimeSessions.delete(sessionId);
	await session.connection.cancel();
}

function resolveProviderId(providerId: string | undefined): string {
	const normalized = normalizeProviderId(providerId ?? 'openai');
	if (supportsCapability(normalized, 'speech-to-text')) {
		return normalized;
	}
	throw new SttProviderUnsupportedError(`Speech-to-text provider is not supported: ${normalized}`);
}

function resolveModelId(
	providerId: string,
	modelId: string | undefined,
	apiType: SpeechToTextApiType
): string {
	if (modelId) {
		if (!supportsSpeechToTextApiType(providerId, modelId, apiType)) {
			throw new SttProviderUnsupportedError(
				`Speech-to-text model does not support ${apiType} transcription: ${providerId}/${modelId}`
			);
		}
		return modelId;
	}

	const model = providerModels(providerId, 'speech-to-text').find((candidate) =>
		speechToTextApiTypes(providerId, candidate.id).includes(apiType)
	);
	if (!model) {
		throw new SttProviderUnsupportedError(
			`Speech-to-text provider has no ${apiType} transcription model: ${providerId}`
		);
	}
	return model.id;
}

function resolveProvider(providerId: string): SttProviderSpec {
	const provider = getProviderSpecFromProviderStore(providerId);
	if (!provider.apiKey) {
		throw new SttProviderAuthError(`${provider.name} API key not configured.`);
	}
	return provider;
}

function resolveRealtimeSession(sessionId: string): SttActiveRealtimeSession {
	const normalized = sessionId.trim();
	const session = realtimeSessions.get(normalized);
	if (!session) throw new Error(`Unknown speech-to-text realtime session: ${normalized}`);
	return session;
}

function getConfiguredProviderId(mode: SttSelectionMode): string | undefined {
	const providerId = getTranscribeProviderId(mode);
	if (!providerId) return undefined;
	try {
		return resolveProviderId(providerId);
	} catch {
		return undefined;
	}
}

function getConfiguredModelId(
	providerId: string,
	apiType: SpeechToTextApiType,
	mode: SttSelectionMode
): string | undefined {
	const configuredProviderId = getConfiguredProviderId(mode);
	if (!configuredProviderId || configuredProviderId !== providerId) return undefined;
	const modelId = getTranscribeModelId(mode);
	return modelId && supportsSpeechToTextApiType(providerId, modelId, apiType) ? modelId : undefined;
}

function getProviderSpecFromProviderStore(providerId: string): SttProviderSpec {
	const stored = getProvider(providerId);
	const defaults = defaultProvider(providerId);
	return {
		id: providerId,
		name: stored?.name || defaults?.name || providerId,
		apiKey: stored?.apiKey.trim() ?? '',
		baseURL: stored?.baseUrl || speechToTextBaseUrl(providerId),
	};
}

function defaultProvider(providerId: string): CatalogProvider | undefined {
	return loadProviders().find((provider) => provider.id === providerId);
}

function publicProvider(providerId: string): PublicProvider | undefined {
	const provider = defaultProvider(providerId);
	if (!provider) return undefined;
	return {
		id: provider.id,
		name: provider.name,
		baseUrl: provider.baseUrl,
		...(provider.capabilities ? { capabilities: provider.capabilities } : {}),
		...(provider.apiConfiguration ? { apiConfiguration: provider.apiConfiguration } : {}),
	};
}

function findSpeechToTextModel(providerId: string, modelId: string): ProviderModel | undefined {
	const normalizedModelId = modelId.trim();
	return providerModels(providerId, 'speech-to-text').find(
		(model) => model.id === normalizedModelId
	);
}

function realtimeSampleRate(providerId: string): number {
	return speechToTextSampleRate(providerId) ?? STT_DEFAULT_REALTIME_SAMPLE_RATE;
}
