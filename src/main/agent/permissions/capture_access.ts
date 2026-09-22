import fs from 'node:fs';
import type { AuthorizedPath } from './access';

export function captureAccess(targets: readonly string[]): AuthorizedPath[] {
	return [...new Set(targets)].map((target) => {
		try {
			const stat = fs.lstatSync(target);
			return { path: target, exists: true, dev: stat.dev, ino: stat.ino, size: stat.size, modifiedAt: stat.mtimeMs };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			return { path: target, exists: false };
		}
	});
}
