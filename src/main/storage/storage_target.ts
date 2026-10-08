import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function storageTarget(root: string, key: string, prefix: string): Promise<string> {
	if (!key.startsWith(prefix)) {
		throw new Error(`Storage object is outside the selected folder: ${key}`);
	}
	const relativeKey = key.slice(prefix.length);
	const segments = relativeKey.split('/');
	if (!relativeKey || relativeKey.includes('\\') || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment === '.kucedr-recovery')) {
		throw new Error(`Unsafe storage object key: ${key}`);
	}
	const resolvedRoot = path.resolve(root);
	const target = path.resolve(resolvedRoot, ...segments);
	const relative = path.relative(resolvedRoot, target);
	if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error(`Storage object escapes the selected folder: ${key}`);
	}
	let current = resolvedRoot;
	for (const segment of segments) {
		current = path.join(current, segment);
		try {
			if ((await fs.lstat(current)).isSymbolicLink()) {
				throw new Error(`Storage object crosses a symbolic link: ${key}`);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return target;
}
