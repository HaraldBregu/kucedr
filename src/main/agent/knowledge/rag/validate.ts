export function validateVector(vector: readonly number[], dimensions: number): void {
	if (
		!Number.isInteger(dimensions) ||
		dimensions < 1 ||
		dimensions > 65_536 ||
		vector.length !== dimensions ||
		vector.some((value) => !Number.isFinite(value) || !Number.isFinite(Math.fround(value))) ||
		!vector.some((value) => Math.fround(value) !== 0)
	) {
		throw new Error('Invalid embedding vector or dimensions.');
	}
}
