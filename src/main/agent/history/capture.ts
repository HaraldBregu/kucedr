import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { readFileBoundedSync } from '../files/read_sync';
import { MAX_READ_BYTES } from '../tools/core/limit';
import type { FileSnapshot } from './types';

export function captureFiles(targets: readonly string[]): FileSnapshot[] {
	return [...new Set(targets)].map((target) => {
		try {
			if (fs.lstatSync(target).size > MAX_READ_BYTES) return { path: target, exists: true, tooLarge: true };
			const { content, mode } = readFileBoundedSync(target, MAX_READ_BYTES);
			return { path: target, exists: true, content: content.toString('base64'), mode,
				hash: createHash('sha256').update(content).digest('hex') };
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			return { path: target, exists: false };
		}
	});
}
