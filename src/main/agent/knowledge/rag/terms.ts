export function ftsQuery(text: string): string | undefined {
	const terms = [
		...new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:[-_.:/][\p{L}\p{N}]+)*/gu) ?? []),
	].slice(0, 32);
	return terms.length > 0 ? terms.map((term) => `"${term}"`).join(' OR ') : undefined;
}
