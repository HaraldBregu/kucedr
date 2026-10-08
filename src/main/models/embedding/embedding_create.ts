import type { EmbeddingRequest, EmbeddingResult } from '../../../shared/embedding_types';
import { generateEmbeddings } from '../adapters/embedding';
import { defaultProviderId, providerModels } from '../../models';
import { getProvider } from '../../settings_store';
import { getModelId, getProviderId } from '../selection';
import { EMBEDDING_PROVIDERS } from './embedding_providers';
import { validateEmbeddingVectors } from '../adapters/embedding/validate';

export async function createEmbedding(
	request: EmbeddingRequest,
	signal?: AbortSignal
): Promise<EmbeddingResult> {
	signal?.throwIfAborted();
	if (!Array.isArray(request.texts) || request.texts.length === 0) {
		throw new Error('Text to embed is required.');
	}
	const texts = request.texts.map((text) => (typeof text === 'string' ? text.trim() : ''));
	if (texts.some((text) => !text)) throw new Error('Every embedding input must contain text.');

	const providerId = (
		request.providerId ?? getProviderId('embedding') ?? defaultProviderId('embedding') ?? ''
	).trim();
	const provider = EMBEDDING_PROVIDERS[providerId];
	if (!provider) throw new Error(`Embedding provider is not supported: ${providerId}`);
	if (request.requireRemote && provider.local) {
		throw new Error('A remote embedding provider is required.');
	}
	const modelId =
		(request.modelId ?? getModelId('embedding'))?.trim() ||
		providerModels(providerId, 'embedding')[0]?.id;
	if (!modelId) throw new Error(`No embedding models available for provider: ${providerId}`);
	const apiKey = getProvider(providerId)?.apiKey.trim() ?? '';
	if (!apiKey && !provider.local) {
		throw new Error(`${provider.name} API key not configured.`);
	}

	const embeddings = await generateEmbeddings({
		providerId,
		apiKey,
		modelId,
		// ponytail: self-hosted endpoint moves via BGE_BASE_URL; no settings field until asked.
		baseURL: (provider.local && process.env.BGE_BASE_URL?.trim()) || provider.url,
		texts,
		inputType: request.inputType,
		signal,
	});
	signal?.throwIfAborted();
	const dimensions = validateEmbeddingVectors(embeddings, texts.length, provider.name);
	return { providerId, modelId, dimensions, embeddings };
}
