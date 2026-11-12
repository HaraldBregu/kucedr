import { normalizeProviderId } from '../../../shared/provider_types';
import {
	normalizeImageSource,
	type ImageRequest,
	type ImageResult,
} from '../../../shared/image_types';
import { findModel, loadProviders, providerModels, supportsCapability } from '../../models';
import { getProvider } from '../../settings_store';
import {
	generateImage,
	ImageProviderAuthError,
	ImageProviderRequestError,
	ImageProviderUnsupportedError,
} from '../adapters/tti';
import { getModelId, getProviderId, resolveOptions } from '../selection';

const DEFAULT_IMAGE_PROVIDER_ID = 'google';

export async function createImage(
	request: ImageRequest,
	signal?: AbortSignal
): Promise<ImageResult> {
	const prompt = request.prompt?.trim();
	if (!prompt) throw new ImageProviderRequestError('Prompt is required.');

	const providerId = resolveProviderId(
		request.providerId ?? getProviderId('image') ?? DEFAULT_IMAGE_PROVIDER_ID
	);
	const modelId = resolveModelId(providerId, request.modelId ?? getModelId('image'));
	const apiKey = resolveApiKey(providerId);
	const model = findModel(providerId, 'text-to-image', modelId);
	if (!model) throw new ImageProviderUnsupportedError(`Unknown text-to-image model: ${providerId}/${modelId}`);
	const stored = getProvider(providerId);
	const baseUrl = stored?.baseUrl && stored.baseUrl !== model.provider.baseUrl ? stored.baseUrl : model.url;
	return generateImage({
		model: { ...model, url: baseUrl },
		apiKey,
		prompt,
		source: normalizeImageSource(request.source),
		options: resolveOptions('image', providerId, modelId, request.options),
		signal,
	});
}

function resolveProviderId(providerId: string): string {
	const normalized = normalizeProviderId(providerId);
	if (!supportsCapability(normalized, 'text-to-image')) {
		throw new ImageProviderUnsupportedError(
			`Text-to-image provider is not supported: ${normalized}`
		);
	}
	return normalized;
}

function resolveModelId(providerId: string, modelId: string | undefined): string {
	if (modelId?.trim()) return modelId.trim();
	const fallback = providerModels(providerId, 'text-to-image')[0]?.id;
	if (!fallback) {
		throw new ImageProviderUnsupportedError(
			`No text-to-image models available for provider: ${providerId}`
		);
	}
	return fallback;
}

function resolveApiKey(providerId: string): string {
	const stored = getProvider(providerId);
	const apiKey = stored?.apiKey.trim() ?? '';
	if (!apiKey) {
		const defaults = loadProviders().find((provider) => provider.id === providerId);
		throw new ImageProviderAuthError(
			`${stored?.name || defaults?.name || providerId} API key not configured.`
		);
	}
	return apiKey;
}
