import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isProtected } from './protected.mjs';

export async function walk(dir, protectedRoot) {
	const files = [];
	const pending = [dir];
	while (pending.length > 0) {
		const current = pending.pop();
		for (const entry of await fs.readdir(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.name === '.kucedr-recovery' || isProtected(full, protectedRoot) || entry.isSymbolicLink())
				continue;
			if (entry.isDirectory()) pending.push(full);
			else if (entry.isFile()) files.push(full);
		}
	}
	return files;
}
