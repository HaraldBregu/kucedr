import { normalizeProviderId } from '../../../shared/provider_types';
import type { VideoRequest, VideoResult } from '../../../shared/video_types';
import {
	defaultProviderId,
	findModel,
	loadProviders,
	providerModels,
	supportsCapability,
} from '../../models';
import { getProvider } from '../../settings_store';
import {
	generateVideo,
	VideoProviderAuthError,
	VideoProviderRequestError,
	VideoProviderUnsupportedError,
} from '../adapters/ttv';
import { getModelId, getProviderId, resolveOptions } from '../selection';

export async function createVideo(
	request: VideoRequest,
	signal?: AbortSignal
): Promise<VideoResult> {
	const prompt = request.prompt?.trim();
	if (!prompt) throw new VideoProviderRequestError('Prompt is required.');

	const providerId = resolveProviderId(
		request.providerId ?? getProviderId('video') ?? DEFAULT_VIDEO_PROVIDER_ID
	);
	const modelId = resolveModelId(providerId, request.modelId ?? getModelId('video'));
	const apiKey = resolveApiKey(providerId);
	return generateVideo({
		providerId,
		apiKey,
		modelId,
		prompt,
		options: resolveOptions('video', providerId, modelId, request.options),
		signal,
	});
}

function resolveProviderId(providerId: string): string {
	const normalized = normalizeProviderId(providerId);
	if (!supportsCapability(normalized, 'text-to-video')) {
		throw new VideoProviderUnsupportedError(
			`Text-to-video provider is not supported: ${normalized}`
		);
	}
	return normalized;
}

function resolveModelId(providerId: string, modelId: string | undefined): string {
	const models = providerModels(providerId, 'text-to-video');
	const selected = modelId?.trim();
	if (selected && models.some((model) => model.id === selected)) return selected;
	const fallback = models[0]?.id;
	if (!fallback) {
		throw new VideoProviderUnsupportedError(
			`No text-to-video models available for provider: ${providerId}`
		);
	}
	return fallback;
}

function resolveApiKey(providerId: string): string {
	const stored = getProvider(providerId);
	const apiKey = stored?.apiKey.trim() ?? '';
	if (!apiKey) {
		const defaults = loadProviders().find((provider) => provider.id === providerId);
		throw new VideoProviderAuthError(
			`${stored?.name || defaults?.name || providerId} API key not configured.`
		);
	}
	return apiKey;
}
