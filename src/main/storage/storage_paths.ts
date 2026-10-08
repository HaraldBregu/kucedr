import path from 'node:path';
import { realPath } from '../shared/real_path';
import { isProtectedStoragePath } from './storage_protected';

export function normalizeStoragePaths(value: unknown): string[] {
	if (!Array.isArray(value) || value.length > 32) throw new Error('Invalid storage folders.');
	const normalized = value.map((entry) => {
		if (typeof entry !== 'string' || !path.isAbsolute(entry) || entry.length > 4096) {
			throw new Error('Storage folders must use absolute paths.');
		}
		const resolved = realPath(entry);
		if (resolved === path.parse(resolved).root) {
			throw new Error('A filesystem root cannot be synchronized.');
		}
		if (isProtectedStoragePath(resolved)) {
			throw new Error('Sensitive application data cannot be included in cloud backup.');
		}
		return resolved;
	});
	return [...new Set(normalized)];
}
