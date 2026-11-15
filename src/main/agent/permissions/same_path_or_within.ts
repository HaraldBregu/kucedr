import fs from 'node:fs';
import path from 'node:path';
import { realPath } from '../../shared/real_path';
import { isPathWithin } from './permissions_path';

export function samePathOrWithin(target: string, root: string): boolean {
	const fold = (value: string): string =>
		process.platform === 'darwin' || process.platform === 'win32' ? value.toLowerCase() : value;
	const resolvedTarget = realPath(target);
	const resolvedRoot = realPath(root);
	if (isPathWithin(fold(resolvedRoot), fold(resolvedTarget))) return true;
	const identity = fs.statSync(resolvedRoot, { bigint: true, throwIfNoEntry: false });
	if (!identity || identity.ino === 0n) return false;
	for (let current = resolvedTarget; ; current = path.dirname(current)) {
		const stat = fs.statSync(current, { bigint: true, throwIfNoEntry: false });
		if (stat && stat.dev === identity.dev && stat.ino === identity.ino) return true;
		if (path.dirname(current) === current) return false;
	}
}
