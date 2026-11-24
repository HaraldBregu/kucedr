export function estimateTokens(value: string): number {
	return Math.ceil(value.length / 4);
}
