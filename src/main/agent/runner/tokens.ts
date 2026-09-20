export function searchTokens(value: string): string[] {
	return value
		.toLocaleLowerCase()
		.normalize('NFKC')
		.split(/[^\p{L}\p{N}_-]+/u)
		.map((token) => token.trim())
		.filter((token) => token.length >= 2);
}
