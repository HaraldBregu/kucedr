import { requestEmbeddings } from './embedding_shared';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function createNomicEmbeddingAdapter(spec: EmbeddingProviderSpec): EmbeddingAdapter {
	return {
		async embed(request) {
			const payload = (await requestEmbeddings(
				spec,
				{
					model: spec.model,
					texts: request.texts,
					task_type: request.inputType === 'query' ? 'search_query' : 'search_document',
					long_text_mode: 'mean',
				},
				request.signal
			)) as { embeddings?: number[][] };
			return payload.embeddings ?? [];
		},
	};
}
