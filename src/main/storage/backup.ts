import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StoragePushResult } from '../../shared/storage_types';
import { describeStorageError } from './storage_error';
import { normalizeStoragePaths } from './storage_paths';
import { storagePrefix } from './storage_prefix';
import type { StorageObjectStore } from './remote';
import { getStorageSettings } from './storage_store';
import { walkFiles } from './storage_walk';
import { uploadBackupFile } from './upload';
import type { BackupSnapshot } from './snapshot';

export async function backupFiles(store: StorageObjectStore): Promise<StoragePushResult> {
	const paths = normalizeStoragePaths(getStorageSettings().paths);
	if (!paths.length) throw new Error('Select at least one folder to back up.');
	const uploaded: string[] = [];
	const failed: StoragePushResult['failed'] = [];
	for (const root of paths) {
		try {
			const stat = await fs.lstat(root);
			if (stat.isSymbolicLink()) throw new Error(`Selected path is a symbolic link: ${root}`);
			const prefix = storagePrefix(root).replace('kucedr/v1/', 'kucedr/v2/');
			const timestamp = performance.timeOrigin + performance.now();
			const id = `${new Date(timestamp).toISOString()}-${Math.floor(timestamp * 1000)}-${randomUUID()}`;
			const snapshot: BackupSnapshot = {
				version: 2,
				createdAt: new Date().toISOString(),
				folder: path.basename(root),
				files: [],
			};
			const sources = stat.isDirectory() ? await walkFiles(root) : [root];
			const completed: string[] = [];
			for (const source of sources) {
				try {
					const relative = stat.isDirectory()
						? path.relative(root, source).split(path.sep).join('/')
						: path.basename(root);
					const file = await uploadBackupFile(store, source, `${prefix}files/${id}/${relative}`);
					snapshot.files.push({ ...file, path: relative });
					completed.push(source);
				} catch (error) {
					failed.push({ path: source, error: describeStorageError(error) });
				}
			}
			if (completed.length !== sources.length) continue;
			await store.put(
				`${prefix}snapshots/${id}.json`,
				Buffer.from(JSON.stringify(snapshot)),
				'application/json'
			);
			uploaded.push(...completed);
		} catch (error) {
			failed.push({ path: root, error: describeStorageError(error) });
		}
	}
	return { uploaded, failed };
}
