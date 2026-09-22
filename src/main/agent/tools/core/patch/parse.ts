import { parseHunk } from './hunk';
import type { Hunk } from './types';

const BEGIN_PATCH_MARKER = '*** Begin Patch';
const END_PATCH_MARKER = '*** End Patch';

export function parsePatch(input: string): Hunk[] {
	const lines = input.trim().split(/\r?\n/);
	if (lines[0]?.trim() !== BEGIN_PATCH_MARKER)
		throw new Error("The first line of the patch must be '*** Begin Patch'");
	if (lines[lines.length - 1]?.trim() !== END_PATCH_MARKER)
		throw new Error("The last line of the patch must be '*** End Patch'");

	const hunks: Hunk[] = [];
	let remaining = lines.slice(1, -1);
	let lineNumber = 2;
	while (remaining.length > 0) {
		const { hunk, consumed } = parseHunk(remaining, lineNumber);
		hunks.push(hunk);
		lineNumber += consumed;
		remaining = remaining.slice(consumed);
	}
	if (hunks.length === 0) throw new Error('Patch contains no file hunks.');
	return hunks;
}

