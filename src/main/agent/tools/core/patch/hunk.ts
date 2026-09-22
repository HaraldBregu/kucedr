import { parseUpdateChunk } from './chunk';
import type { Hunk, UpdateChunk } from './types';

const ADD_FILE_MARKER = '*** Add File: ';
const DELETE_FILE_MARKER = '*** Delete File: ';
const UPDATE_FILE_MARKER = '*** Update File: ';
const MOVE_TO_MARKER = '*** Move to: ';

export function parseHunk(lines: string[], lineNumber: number): { hunk: Hunk; consumed: number } {
	const first = lines[0].trim();

	if (first.startsWith(ADD_FILE_MARKER)) {
		let contents = '';
		let consumed = 1;
		for (const line of lines.slice(1)) {
			if (!line.startsWith('+')) break;
			contents += `${line.slice(1)}\n`;
			consumed += 1;
		}
		return { hunk: { kind: 'add', path: first.slice(ADD_FILE_MARKER.length), contents }, consumed };
	}

	if (first.startsWith(DELETE_FILE_MARKER)) {
		return { hunk: { kind: 'delete', path: first.slice(DELETE_FILE_MARKER.length) }, consumed: 1 };
	}

	if (first.startsWith(UPDATE_FILE_MARKER)) {
		const targetPath = first.slice(UPDATE_FILE_MARKER.length);
		let remaining = lines.slice(1);
		let consumed = 1;
		let movePath: string | undefined;
		if (remaining[0]?.trim().startsWith(MOVE_TO_MARKER)) {
			movePath = remaining[0].trim().slice(MOVE_TO_MARKER.length);
			remaining = remaining.slice(1);
			consumed += 1;
		}

		const chunks: UpdateChunk[] = [];
		while (remaining.length > 0) {
			if (remaining[0].trim() === '') {
				remaining = remaining.slice(1);
				consumed += 1;
				continue;
			}
			if (remaining[0].startsWith('***')) break;
			const { chunk, consumed: chunkLines } = parseUpdateChunk(
				remaining,
				lineNumber + consumed,
				chunks.length === 0
			);
			chunks.push(chunk);
			remaining = remaining.slice(chunkLines);
			consumed += chunkLines;
		}
		if (chunks.length === 0)
			throw new Error(
				`Invalid patch hunk at line ${lineNumber}: Update file hunk for path '${targetPath}' is empty`
			);
		return { hunk: { kind: 'update', path: targetPath, movePath, chunks }, consumed };
	}

	throw new Error(
		`Invalid patch hunk at line ${lineNumber}: '${lines[0]}' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'`
	);
}

