import { chunkSpans } from './spans';

export function chunkText(text: string): string[] {
	return chunkSpans(text).map((chunk) => chunk.text);
}
