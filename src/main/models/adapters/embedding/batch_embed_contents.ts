import type { EmbeddingAdapter, EmbeddingProviderSpec } from './embedding_types';

export function createBatchEmbedContentsAdapter(spec: EmbeddingProviderSpec): EmbeddingAdapter {
	return {
		async embed(request) {
			const model = spec.model.replace(/^models\//, '');
			const baseURL = spec.baseURL.replace(/\/$/, '');
			const response = await fetch(`${baseURL}/models/${model}:batchEmbedContents`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-goog-api-key': spec.apiKey },
				body: JSON.stringify({
					requests: request.texts.map((text) => ({
						model: `models/${model}`,
						content: { parts: [{ text }] },
						...(spec.metadata?.inputTemplates
							? {}
							: {
									taskType:
										request.inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
								}),
					})),
				}),
				signal: request.signal,
			});
			if (!response.ok) {
				throw new Error(
					`${spec.name} embeddings failed (${response.status}): ${response.statusText}`
				);
			}
			const payload = (await response.json()) as { embeddings?: { values?: number[] }[] };
			return payload.embeddings?.map((embedding) => embedding.values ?? []) ?? [];
		},
	};
}
