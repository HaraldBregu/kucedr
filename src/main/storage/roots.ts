import { normalizeStoragePaths } from './storage_paths';
import { storagePrefix } from './storage_prefix';

export function transferRoots(value: unknown): string[] {
	const roots = normalizeStoragePaths(value);
	const prefixes = roots.map(storagePrefix);
	if (new Set(prefixes).size !== prefixes.length) throw new Error('Selected storage folders must have different names to avoid overwriting each other.');
	return roots;
}
