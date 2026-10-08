import type { RagChunkSpan } from './types';

export function chunkSpans(text: string): RagChunkSpan[] {
	const normalized = text.replace(/\r\n?/g, '\n');
	const chunks: RagChunkSpan[] = [];
	let start = 0;
	let lineStart = 1;
	while (start < normalized.length) {
		while (start < normalized.length && /\s/.test(normalized[start])) {
			if (normalized[start] === '\n') lineStart += 1;
			start += 1;
		}
		if (start === normalized.length) break;
		let end = Math.min(start + 2_000, normalized.length);
		if (end < normalized.length && /[\uD800-\uDBFF]/.test(normalized[end - 1])) end -= 1;
		if (end < normalized.length) {
			const paragraph = normalized.lastIndexOf('\n\n', end);
			const line = normalized.lastIndexOf('\n', end);
			const word = normalized.lastIndexOf(' ', end);
			const boundary = paragraph > start + 1_000 ? paragraph : Math.max(line, word);
			if (boundary > start + 200) end = boundary;
		}
		const chunk = normalized.slice(start, end).trimEnd();
		chunks.push({
			text: chunk,
			lineStart,
			lineEnd: lineStart + chunk.split('\n').length - 1,
		});
		if (end === normalized.length) break;
		let next = Math.max(start + 1, end - 200);
		if (/[\uDC00-\uDFFF]/.test(normalized[next])) next += 1;
		lineStart += normalized.slice(start, next).split('\n').length - 1;
		start = next;
	}
	return chunks;
}
