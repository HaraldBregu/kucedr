import type { UpdateChunk } from './types';

const EOF_MARKER = '*** End of File';

export function parseUpdateChunk(
	lines: string[],
	lineNumber: number,
	allowMissingContext: boolean
): { chunk: UpdateChunk; consumed: number } {
	let changeContext: string | undefined;
	let startIndex = 0;
	if (lines[0] === '@@') {
		startIndex = 1;
	} else if (lines[0].startsWith('@@ ')) {
		changeContext = lines[0].slice(3);
		startIndex = 1;
	} else if (!allowMissingContext) {
		throw new Error(
			`Invalid patch hunk at line ${lineNumber}: Expected update hunk to start with a @@ context marker, got: '${lines[0]}'`
		);
	}

	const chunk: UpdateChunk = { changeContext, oldLines: [], newLines: [], isEndOfFile: false };
	let parsedLines = 0;
	for (const line of lines.slice(startIndex)) {
		if (line === EOF_MARKER) {
			chunk.isEndOfFile = true;
			parsedLines += 1;
			break;
		}
		const marker = line[0];
		if (!marker) {
			chunk.oldLines.push('');
			chunk.newLines.push('');
		} else if (marker === ' ') {
			chunk.oldLines.push(line.slice(1));
			chunk.newLines.push(line.slice(1));
		} else if (marker === '+') {
			chunk.newLines.push(line.slice(1));
		} else if (marker === '-') {
			chunk.oldLines.push(line.slice(1));
		} else {
			if (parsedLines === 0)
				throw new Error(
					`Invalid patch hunk at line ${lineNumber}: Unexpected line found in update hunk: '${line}'. Every line should start with ' ' (context line), '+' (added line), or '-' (removed line)`
				);
			break;
		}
		parsedLines += 1;
	}
	if (parsedLines === 0)
		throw new Error(
			`Invalid patch hunk at line ${lineNumber}: Update hunk does not contain any lines`
		);
	return { chunk, consumed: parsedLines + startIndex };
}

