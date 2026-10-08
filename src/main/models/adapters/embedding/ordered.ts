export function orderedEmbeddings(payload: unknown, count: number, provider: string): number[][] {
	const data = (payload as { data?: unknown } | null)?.data;
	if (!Array.isArray(data) || data.length !== count) {
		throw new Error(`${provider} returned malformed embeddings.`);
	}
	const embeddings: number[][] = new Array(count);
	for (const item of data) {
		const index = item?.index;
		if (
			!Number.isInteger(index) ||
			index < 0 ||
			index >= count ||
			embeddings[index] !== undefined ||
			!Array.isArray(item?.embedding)
		) {
			throw new Error(`${provider} returned malformed embedding indexes.`);
		}
		embeddings[index] = item.embedding;
	}
	return embeddings;
}
