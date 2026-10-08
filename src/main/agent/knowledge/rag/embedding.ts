import type { EmbeddingResult } from '../../../../shared/embedding_types';
import { createEmbedding } from '../../../models/embedding';
import type { EmbeddingInput, EmbeddingProvider } from './types';

export class SelectedEmbeddingProvider implements EmbeddingProvider {
	async embed(input: EmbeddingInput, signal?: AbortSignal): Promise<EmbeddingResult> {
		if (!input.providerId.trim() || !input.modelId.trim()) {
			throw new Error('Select an embedding provider and model before indexing.');
		}
		return createEmbedding(input, signal);
	}
}
