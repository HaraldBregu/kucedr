import { seal } from './seal';
import { isVaultEnabled } from './state';

export const LINE_PREFIX = 'v1:';

// Append-only files such as run.jsonl are sealed one line at a time, since a sealed whole file
// cannot be appended to. A plain JSON line starts with `{`, so both kinds can share a file.
export function sealLine(line: string): string {
	return isVaultEnabled() ? `${LINE_PREFIX}${seal(line).toString('base64')}` : line;
}
