import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { captureFiles } from './capture';
import { validateFilePath } from '../files/validate';
import type { FileSnapshot } from './types';

export function restoreFiles(expected: FileSnapshot[], replacement: FileSnapshot[]): void {
	const tooLarge = [...expected, ...replacement].find((snapshot) => snapshot.tooLarge);
	if (tooLarge) throw new Error(`File history cannot restore ${tooLarge.path}: it exceeded the history size limit.`);
	const current = captureFiles(expected.map((snapshot) => snapshot.path));
	if (current.some((snapshot, index) =>
		snapshot.tooLarge || snapshot.exists !== expected[index].exists || snapshot.hash !== expected[index].hash
	)) throw new Error('Files changed after this operation; refusing to overwrite newer changes.');

	const writes = replacement.map((snapshot) => {
		const before = expected.find((entry) => entry.path === snapshot.path);
		if (!before) throw new Error('File history is missing an expected path.');
		return { snapshot, before, identities: validateFilePath(snapshot.path, !before.exists) };
	});

	for (const { snapshot, before, identities } of writes) {
		if (JSON.stringify(validateFilePath(snapshot.path, !before.exists)) !== JSON.stringify(identities))
			throw new Error('File history path changed before restoring.');
		if (!snapshot.exists) {
			if (before.exists) fs.unlinkSync(snapshot.path);
			continue;
		}
		const restored = Buffer.from(snapshot.content ?? '', 'base64');
		if (!before.exists) {
			fs.writeFileSync(snapshot.path, restored, { flag: 'wx', mode: snapshot.mode ?? 0o666 });
			continue;
		}
		const temporary = path.join(path.dirname(snapshot.path), `.${path.basename(snapshot.path)}.${randomUUID()}.tmp`);
		try {
			fs.writeFileSync(temporary, restored, { flag: 'wx', mode: 0o600 });
			fs.chmodSync(temporary, (snapshot.mode ?? 0o666) & 0o7777);
			fs.renameSync(temporary, snapshot.path);
		} finally { fs.rmSync(temporary, { force: true }); }
	}
}
