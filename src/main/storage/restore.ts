import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StorageObjectStore } from './remote';
import type { BackupSnapshot } from './snapshot';
import { storageTarget } from './storage_target';
import { fileDigest } from './digest';
import { preserveRestoreTarget } from './recovery';
import { isProtectedStoragePath } from './storage_protected';

export async function restoreBackupFile(store: StorageObjectStore, root: string, prefix: string, file: BackupSnapshot['files'][number]): Promise<boolean> {
	if (!file.key.startsWith(`${prefix}files/`)) throw new Error('Backup file is outside its snapshot folder.');
	if (file.path.split('/').includes('.kucedr-recovery') || file.path.includes('\\')) throw new Error('Unsafe backup file path.');
	const target = await storageTarget(root, `${prefix}${file.path}`, prefix);
	if (isProtectedStoragePath(target)) throw new Error('Backup targets a protected application folder.');
	await fs.mkdir(path.dirname(target), { recursive: true });
	const temporary = `${target}.kucedr-${randomUUID()}.tmp`;
	try {
		if (store.getFile) await store.getFile(file.key, temporary);
		else await fs.writeFile(temporary, await store.get(file.key), { flag: 'wx' });
		if ((await fs.stat(temporary)).size !== file.size || await fileDigest(temporary) !== file.sha256) {
			throw new Error('Backup integrity verification failed.');
		}
		try {
			if (await fileDigest(target) === file.sha256) return false;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		await preserveRestoreTarget(target, root);
		await fs.rename(temporary, target);
		return true;
	} finally {
		await fs.rm(temporary, { force: true });
	}
}
