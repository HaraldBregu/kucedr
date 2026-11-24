const MAX_CHUNK_TOKENS = 24_000;

export function splitChunks(text: string): string[] {
	const maxChars = MAX_CHUNK_TOKENS * 4;
	const chunks: string[] = [];
	for (let start = 0; start < text.length; start += maxChars) chunks.push(text.slice(start, start + maxChars));
	return chunks.length ? chunks : ['(No text content was available.)'];
}
