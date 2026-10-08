import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StoragePullResult } from '../../shared/storage_types';
import { describeStorageError } from './storage_error';
import { getObject } from './storage_get';
import { listObjects } from './storage_list';
import { normalizeStoragePaths } from './storage_paths';
import { storagePrefix } from './storage_prefix';
import type { StorageObjectStore } from './remote';
import { STORAGE_MAX_OBJECT_BYTES } from './limits';
import { getStorageSettings } from './storage_store';
import { storageTarget } from './storage_target';
import { storageWrite } from './storage_write';
import { backupSnapshotSchema } from './snapshot';
import { restoreBackupFile } from './restore';
import { preserveRestoreTarget } from './recovery';

export async function pullFiles(store: StorageObjectStore): Promise<StoragePullResult> {
	const storage = getStorageSettings();
	const paths = normalizeStoragePaths(storage.paths);
	const downloaded: string[] = [];
	const skipped: string[] = [];
	const failed: StoragePullResult['failed'] = [];

	for (const entryPath of paths) {
		const prefix = storagePrefix(entryPath);
		try {
			await fs.mkdir(entryPath, { recursive: true });
			if ((await fs.lstat(entryPath)).isSymbolicLink()) {
				throw new Error(`Selected folder is a symbolic link: ${entryPath}`);
			}
			const snapshotPrefix = prefix.replace('kucedr/v1/', 'kucedr/v2/');
			const manifests = (await listObjects(store, `${snapshotPrefix}snapshots/`))
				.filter((item) => item.key.startsWith(`${snapshotPrefix}snapshots/`) && item.key.endsWith('.json'))
				.sort((a, b) => b.key.localeCompare(a.key));
			if (manifests.length) {
				const snapshot = backupSnapshotSchema.parse(JSON.parse(Buffer.from(await getObject(store, manifests[0].key)).toString('utf8')));
				for (const file of snapshot.files) {
					try {
						if (await restoreBackupFile(store, entryPath, snapshotPrefix, file)) downloaded.push(file.key);
						else skipped.push(file.key);
					} catch (error) {
						failed.push({ path: file.path, error: describeStorageError(error) });
					}
				}
				continue;
			}
			const remote = (await listObjects(store, prefix)).filter((item) => !item.key.endsWith('/'));
			for (const item of remote) {
				try {
					if (item.size > STORAGE_MAX_OBJECT_BYTES) {
						throw new Error('Cloud restore files must be no larger than 50 MiB.');
					}
					const target = await storageTarget(entryPath, item.key, prefix);
					await fs.mkdir(path.dirname(target), { recursive: true });
					const data = await getObject(store, item.key);
					if (data.byteLength > STORAGE_MAX_OBJECT_BYTES) {
						throw new Error('Cloud restore files must be no larger than 50 MiB.');
					}
					await preserveRestoreTarget(target, entryPath);
					await storageWrite(target, data);
					downloaded.push(item.key);
				} catch (error) {
					failed.push({ path: item.key, error: describeStorageError(error) });
				}
			}
		} catch (error) {
			failed.push({ path: entryPath, error: describeStorageError(error) });
		}
	}

	return { downloaded, skipped, failed };
}
