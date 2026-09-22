import { seekSequence } from './sequence';
import type { UpdateChunk } from './types';

export function applyUpdateChunks(filePath: string, contents: string, chunks: UpdateChunk[]): string {
	const lines = contents.split('\n');
	if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

	const replacements: Array<[number, number, string[]]> = [];
	let lineIndex = 0;
	for (const chunk of chunks) {
		if (chunk.changeContext) {
			const ctxIndex = seekSequence(lines, [chunk.changeContext], lineIndex, false);
			if (ctxIndex === null)
				throw new Error(`Failed to find context '${chunk.changeContext}' in ${filePath}`);
			lineIndex = ctxIndex + 1;
		}

		if (chunk.oldLines.length === 0) {
			const insertionIndex = chunk.changeContext && !chunk.isEndOfFile ? lineIndex : lines.length;
			replacements.push([insertionIndex, 0, chunk.newLines]);
			lineIndex = insertionIndex;
			continue;
		}

		let pattern = chunk.oldLines;
		let newSlice = chunk.newLines;
		let found = seekSequence(lines, pattern, lineIndex, chunk.isEndOfFile);
		if (found === null && pattern[pattern.length - 1] === '') {
			pattern = pattern.slice(0, -1);
			if (newSlice.length > 0 && newSlice[newSlice.length - 1] === '')
				newSlice = newSlice.slice(0, -1);
			found = seekSequence(lines, pattern, lineIndex, chunk.isEndOfFile);
		}
		if (found === null)
			throw new Error(
				`Failed to find expected lines in ${filePath}:\n${chunk.oldLines.join('\n')}`
			);
		replacements.push([found, pattern.length, newSlice]);
		lineIndex = found + pattern.length;
	}

	replacements.sort((a, b) => a[0] - b[0]);
	const result = [...lines];
	for (const [startIndex, oldLen, newLines] of [...replacements].reverse()) {
		result.splice(startIndex, oldLen, ...newLines);
	}
	if (result.length === 0 || result[result.length - 1] !== '') result.push('');
	return result.join('\n');
}

