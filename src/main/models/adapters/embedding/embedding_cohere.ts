import { requestEmbeddings } from './embedding_shared';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function createCohereEmbeddingAdapter(spec: EmbeddingProviderSpec): EmbeddingAdapter {
	return {
		async embed(request) {
			const payload = (await requestEmbeddings(
				spec,
				{
					model: spec.model,
					texts: request.texts,
					input_type: request.inputType === 'query' ? 'search_query' : 'search_document',
					embedding_types: ['float'],
					truncate: 'NONE',
				},
				request.signal
			)) as { embeddings?: { float?: number[][] } };
			return payload.embeddings?.float ?? [];
		},
	};
}
