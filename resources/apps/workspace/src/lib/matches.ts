export function countMatches(content: string, query: string): number {
	if (!query) return 0;

	const normalizedContent = content.toLocaleLowerCase();
	const normalizedQuery = query.toLocaleLowerCase();
	let count = 0;
	let index = 0;

	while (index !== -1) {
		index = normalizedContent.indexOf(normalizedQuery, index);
		if (index === -1) break;
		count += 1;
		index += normalizedQuery.length;
	}

	return count;
}
