import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isProtectedStoragePath } from './storage_protected';

export async function walkFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	const pending = [dir];
	while (pending.length > 0) {
		const current = pending.pop();
		if (!current) continue;
		for (const entry of await fs.readdir(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (
				entry.name === '.kucedr-recovery' ||
				isProtectedStoragePath(full) ||
				entry.isSymbolicLink()
			)
				continue;
			if (entry.isDirectory()) pending.push(full);
			else if (entry.isFile()) files.push(full);
		}
	}
	return files;
}
