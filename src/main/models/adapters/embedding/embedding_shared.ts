import type { EmbeddingProviderSpec } from './embedding_types';

export async function requestEmbeddings(
	spec: EmbeddingProviderSpec,
	body: Record<string, unknown>,
	signal?: AbortSignal
): Promise<unknown> {
	const headers: Record<string, string> = {
		Accept: 'application/json',
		'Content-Type': 'application/json',
	};
	if (spec.apiKey) headers.Authorization = `Bearer ${spec.apiKey}`;

	const response = await fetch(spec.baseURL, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		signal,
	});
	if (!response.ok) {
		throw new Error(`${spec.name} embeddings failed (${response.status}): ${response.statusText}`);
	}
	const payload: unknown = await response.json();
	if (
		typeof payload === 'object' &&
		payload !== null &&
		'model' in payload &&
		payload.model !== spec.model
	) {
		throw new Error(`${spec.name} did not use the selected embedding model.`);
	}
	return payload;
}
