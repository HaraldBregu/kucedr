export function validateEmbeddingVectors(
	embeddings: unknown,
	count: number,
	provider: string
): number {
	const dimensions =
		Array.isArray(embeddings) && Array.isArray(embeddings[0]) ? embeddings[0].length : 0;
	if (
		!Array.isArray(embeddings) ||
		embeddings.length !== count ||
		dimensions < 1 ||
		dimensions > 65_536 ||
		embeddings.some(
			(vector) =>
				!Array.isArray(vector) ||
				vector.length !== dimensions ||
				vector.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
				!vector.some((value) => value !== 0)
		)
	) {
		throw new Error(`${provider} returned malformed embeddings.`);
	}
	return dimensions;
}
