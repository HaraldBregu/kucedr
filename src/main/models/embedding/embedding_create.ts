import type { EmbeddingRequest, EmbeddingResult } from '../../../shared/embedding_types';
import { generateEmbeddings } from '../adapters/embedding';
import { defaultProviderId, providerModels } from '../../models';
import { getModelId, getProviderId } from '../selection';
import { embeddingEndpoint } from './endpoint';
import { validateEmbeddingVectors } from '../adapters/embedding/validate';

export async function createEmbedding(
	request: EmbeddingRequest,
	signal?: AbortSignal
): Promise<EmbeddingResult> {
	signal?.throwIfAborted();
	if (!Array.isArray(request.texts) || request.texts.length === 0) {
		throw new Error('Text to embed is required.');
	}
	const texts = Array.from(request.texts, (text) => (typeof text === 'string' ? text.trim() : ''));
	if (texts.some((text) => !text)) throw new Error('Every embedding input must contain text.');

	const providerId = (
		request.providerId ??
		getProviderId('embedding') ??
		defaultProviderId('embedding') ??
		''
	).trim();
	const modelId =
		(request.modelId ?? getModelId('embedding'))?.trim() ||
		providerModels(providerId, 'embedding')[0]?.id;
	if (!modelId) throw new Error(`No embedding models available for provider: ${providerId}`);
	const { model, url, apiKey } = embeddingEndpoint(providerId, modelId);
	if (request.requireRemote && model.location === 'local') {
		throw new Error('A remote embedding provider is required.');
	}
	if (!apiKey && model.location !== 'local' && model.authentication !== 'none') {
		throw new Error(`${model.provider.name} API key not configured.`);
	}

	const embeddings = await generateEmbeddings({
		model,
		apiKey,
		baseURL: url,
		texts,
		inputType: request.inputType,
		signal,
	});
	signal?.throwIfAborted();
	const dimensions = validateEmbeddingVectors(embeddings, texts.length, model.provider.name);
	return { providerId, modelId, dimensions, embeddings };
}
