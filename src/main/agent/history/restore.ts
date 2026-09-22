import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { captureFiles } from './capture';
import { validateFilePath } from '../files/validate';
import type { FileSnapshot } from './types';

export function restoreFiles(expected: FileSnapshot[], replacement: FileSnapshot[]): void {
	const current = captureFiles(expected.map((snapshot) => snapshot.path));
	if (current.some((snapshot, index) =>
		snapshot.exists !== expected[index].exists || snapshot.hash !== expected[index].hash
	)) throw new Error('Files changed after this operation; refusing to overwrite newer changes.');

	for (const snapshot of replacement) {
		const before = expected.find((entry) => entry.path === snapshot.path);
		if (!before) throw new Error('File history is missing an expected path.');
		const identities = validateFilePath(snapshot.path, !before.exists);
		if (!snapshot.exists) {
			if (before.exists) fs.unlinkSync(snapshot.path);
			continue;
		}
		const flags = fs.constants.O_RDWR | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK |
			(before.exists ? 0 : fs.constants.O_CREAT | fs.constants.O_EXCL);
		const descriptor = fs.openSync(snapshot.path, flags, snapshot.mode ?? 0o600);
		try {
			const stat = fs.fstatSync(descriptor);
			if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('Invalid file history target.');
			if (before.exists) {
				const selected = identities.at(-1);
				if (stat.dev !== selected?.dev || stat.ino !== selected.ino || JSON.stringify(validateFilePath(snapshot.path)) !== JSON.stringify(identities))
					throw new Error('File history path changed before restoring.');
				const content = Buffer.alloc(stat.size);
				let offset = 0;
				while (offset < content.length) {
					const count = fs.readSync(descriptor, content, offset, content.length - offset, offset);
					if (count === 0) break;
					offset += count;
				}
				if (createHash('sha256').update(content.subarray(0, offset)).digest('hex') !== before.hash)
					throw new Error('Files changed after this operation; refusing to overwrite newer changes.');
			}
			const restored = Buffer.from(snapshot.content ?? '', 'base64');
			if (restored.length > 2 * 1024 * 1024) throw new Error('File history exceeds the byte limit.');
			fs.ftruncateSync(descriptor, 0);
			fs.writeFileSync(descriptor, restored);
		} finally { fs.closeSync(descriptor); }
	}
}
