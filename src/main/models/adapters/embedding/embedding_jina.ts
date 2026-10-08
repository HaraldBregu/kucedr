import { requestEmbeddings } from './embedding_shared';
import { orderedEmbeddings } from './ordered';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function createJinaEmbeddingAdapter(spec: EmbeddingProviderSpec): EmbeddingAdapter {
	return {
		async embed(request) {
			const payload = await requestEmbeddings(
				spec,
				{
					model: spec.model,
					input: request.texts,
					task: request.inputType === 'query' ? 'retrieval.query' : 'retrieval.passage',
					truncate: false,
					embedding_type: 'float',
				},
				request.signal
			);
			return orderedEmbeddings(payload, request.texts.length, spec.name);
		},
	};
}
