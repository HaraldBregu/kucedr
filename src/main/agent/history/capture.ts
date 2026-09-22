import { createHash } from 'node:crypto';
import { readFileBoundedSync } from '../files/read_sync';
import type { FileSnapshot } from './types';

export function captureFiles(targets: readonly string[]): FileSnapshot[] {
	return [...new Set(targets)].map((target) => {
		try {
			const { content, mode } = readFileBoundedSync(target, 2 * 1024 * 1024);
			return { path: target, exists: true, content: content.toString('base64'), mode,
				hash: createHash('sha256').update(content).digest('hex') };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			return { path: target, exists: false };
		}
	});
}
