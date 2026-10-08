import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StorageObjectStore } from './remote';
import { fileDigest } from './digest';
import { STORAGE_MAX_OBJECT_BYTES } from './limits';
import type { BackupSnapshot } from './snapshot';

export async function uploadBackupFile(
	store: StorageObjectStore,
	source: string,
	key: string
): Promise<BackupSnapshot['files'][number]> {
	const staging = await fs.mkdtemp(path.join(tmpdir(), 'kucedr-backup-'));
	const file = path.join(staging, 'file');
	try {
		const original = await fs.lstat(source);
		if (!original.isFile() || original.isSymbolicLink())
			throw new Error('Backup source is not a regular file.');
		await fs.copyFile(source, file);
		const size = (await fs.stat(file)).size;
		const sha256 = await fileDigest(file);
		if (store.putFile) await store.putFile(key, file);
		else {
			if (size > STORAGE_MAX_OBJECT_BYTES)
				throw new Error('This storage does not support streamed file uploads.');
			await store.put(key, await fs.readFile(file));
		}
		return { path: '', key, size, sha256, mode: original.mode & 0o777, modifiedAt: original.mtimeMs };
	} finally {
		await fs.rm(staging, { recursive: true, force: true });
	}
}
