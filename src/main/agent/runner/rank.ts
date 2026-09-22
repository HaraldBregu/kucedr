import type { Tool } from '../types';

export interface RankedDocument<T> {
	value: T;
	text: string;
}

export function rankTools<T>(query: string, documents: RankedDocument<T>[]): T[] {
	const terms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [])];
	if (terms.length === 0) return [];
	const tokenized = documents.map((document) => ({
		...document,
		tokens: document.text.toLocaleLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? [],
	}));
	const averageLength =
		tokenized.reduce((sum, document) => sum + document.tokens.length, 0) /
		Math.max(1, tokenized.length);
	return tokenized
		.map((document, index) => {
			const frequencies = new Map<string, number>();
			for (const token of document.tokens)
				frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
			const score = terms.reduce((total, term) => {
				const frequency = frequencies.get(term) ?? 0;
				if (frequency === 0) return total;
				const containing = tokenized.filter((entry) =>
					(entry.tokens as string[]).includes(term)
				).length;
				const inverseFrequency = Math.log(1 + (documents.length - containing + 0.5) / (containing + 0.5));
				const normalized =
					(frequency * 2.2) /
					(frequency + 1.2 * (0.25 + (0.75 * document.tokens.length) / Math.max(1, averageLength)));
				return total + inverseFrequency * normalized;
			}, 0);
			return { value: document.value, score, index };
		})
		.filter((entry) => entry.score > 0)
		.sort((left, right) => right.score - left.score || left.index - right.index)
		.map((entry) => entry.value);
}

export function toolSearchText(tool: Tool): string {
	const properties = tool.schema.properties ?? {};
	return [
		tool.id,
		tool.name,
		tool.description,
		...Object.entries(properties).flatMap(([name, schema]) => [
			name,
			typeof schema === 'object' && schema && 'description' in schema
				? String((schema as { description?: unknown }).description ?? '')
				: '',
		]),
	].join(' ');
}
