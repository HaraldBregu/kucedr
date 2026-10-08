import { chunkSpans } from '../../../../src/main/agent/knowledge/rag/spans';

it('keeps source-relative line ranges for citation metadata', () => {
	expect(chunkSpans('Heading\r\n\r\nFirst detail\r\nSecond detail')).toEqual([
		{
			text: 'Heading\n\nFirst detail\nSecond detail',
			lineStart: 1,
			lineEnd: 4,
		},
	]);
});

it('keeps leading blank lines and repeated passages tied to their exact source locations', () => {
	const text =
		'\n\n' + Array.from({ length: 150 }, (_, index) => `Line ${index}: repeated text`).join('\n');
	const lines = text.split('\n');
	const chunks = chunkSpans(text);
	expect(chunks.length).toBeGreaterThan(1);
	expect(chunks[0].lineStart).toBe(3);
	for (const chunk of chunks) {
		expect(chunk.text.length).toBeLessThanOrEqual(2_000);
		expect(lines.slice(chunk.lineStart - 1, chunk.lineEnd).join('\n')).toContain(chunk.text);
	}
});

it('keeps Unicode code points intact at chunk and overlap boundaries', () => {
	const chunks = chunkSpans('A' + '😀'.repeat(1_400));
	expect(chunks.length).toBeGreaterThan(1);
	expect(chunks.every((chunk) => chunk.text.length <= 2_000 && chunk.text.isWellFormed())).toBe(
		true
	);
});
