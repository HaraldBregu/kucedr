import { requestEmbeddings } from './embedding_shared';
import { orderedEmbeddings } from './ordered';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function createOpenAiEmbeddingAdapter(spec: EmbeddingProviderSpec): EmbeddingAdapter {
	return {
		async embed(request) {
			const payload = await requestEmbeddings(
				spec,
				{ model: spec.model, input: request.texts, encoding_format: 'float' },
				request.signal
			);
			return orderedEmbeddings(payload, request.texts.length, spec.name);
		},
	};
}
