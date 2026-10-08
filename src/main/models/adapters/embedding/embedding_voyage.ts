import { requestEmbeddings } from './embedding_shared';
import { orderedEmbeddings } from './ordered';
import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function createVoyageEmbeddingAdapter(spec: EmbeddingProviderSpec): EmbeddingAdapter {
	return {
		async embed(request) {
			const payload = await requestEmbeddings(
				spec,
				{
					model: spec.model,
					input: request.texts,
					input_type: request.inputType,
					truncation: false,
					output_dtype: 'float',
				},
				request.signal
			);
			return orderedEmbeddings(payload, request.texts.length, spec.name);
		},
	};
}
