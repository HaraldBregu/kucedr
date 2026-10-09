import { createCohereEmbeddingAdapter } from './embedding_cohere';
import { createGoogleEmbeddingAdapter } from './embedding_google';
import { createJinaEmbeddingAdapter } from './embedding_jina';
import { createNomicEmbeddingAdapter } from './embedding_nomic';
import { createOpenAiEmbeddingAdapter } from './embedding_openai';
import { createVoyageEmbeddingAdapter } from './embedding_voyage';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function buildEmbeddingAdapter(provider: EmbeddingProviderSpec): EmbeddingAdapter {
	// ponytail: self-hosted BGE-M3 servers speak the OpenAI embeddings shape.
	if (provider.id === 'openai' || provider.id === 'bge') {
		return createOpenAiEmbeddingAdapter(provider);
	}
	if (provider.id === 'cohere') return createCohereEmbeddingAdapter(provider);
	if (provider.id === 'google') return createGoogleEmbeddingAdapter(provider);
	if (provider.id === 'voyage') return createVoyageEmbeddingAdapter(provider);
	if (provider.id === 'nomic') return createNomicEmbeddingAdapter(provider);
	if (provider.id === 'jina') return createJinaEmbeddingAdapter(provider);
	throw new Error(`Embedding provider is not supported: ${provider.id}`);
}
