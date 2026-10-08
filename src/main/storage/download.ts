import { promises as fs } from 'node:fs';
import type { StoragePullResult } from '../../shared/storage_types';
import type { StorageObjectStore } from './remote';
import { backupSnapshotSchema } from './snapshot';
import { restoreBackupFile } from './restore';
import { describeStorageError } from './storage_error';

export async function downloadSnapshot(store: StorageObjectStore, snapshotKey: string, root: string): Promise<StoragePullResult> {
	if (!/^kucedr\/v2\/.+\/snapshots\/[^/]+\.json$/.test(snapshotKey) || snapshotKey.includes('\\') || snapshotKey.split('/').some((part) => !part || part === '..' || part === '.')) {
		throw new Error('Invalid backup snapshot key.');
	}
	const prefix = snapshotKey.slice(0, snapshotKey.lastIndexOf('snapshots/'));
	const snapshot = backupSnapshotSchema.parse(JSON.parse(Buffer.from(await store.get(snapshotKey)).toString('utf8')));
	await fs.mkdir(root, { recursive: true });
	if ((await fs.lstat(root)).isSymbolicLink()) throw new Error('Restore folder is a symbolic link.');
	const result: StoragePullResult = { downloaded: [], skipped: [], failed: [] };
	for (const file of snapshot.files) {
		try {
			if (await restoreBackupFile(store, root, prefix, file)) result.downloaded.push(file.key);
			else result.skipped.push(file.key);
		} catch (error) {
			result.failed.push({ path: file.path, error: describeStorageError(error) });
		}
	}
	return result;
}
