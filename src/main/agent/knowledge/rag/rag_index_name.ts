const INDEX_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,43}[a-z0-9])?$/;

export function normalizeRagIndexName(value: string): string {
	const indexName = value.trim();
	if (!INDEX_NAME_PATTERN.test(indexName)) {
		throw new Error(
			'Knowledge index name must be 1-45 lowercase letters, numbers, or hyphens, and must start and end with a letter or number.'
		);
	}
	return indexName;
}
