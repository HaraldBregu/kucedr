import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StoragePullResult, StorageRestoreInput } from '../../shared/storage_types';
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
import { preserveRestoreTarget } from './recovery';
import { downloadSnapshot } from './download';

export async function pullFiles(
	store: StorageObjectStore,
	input?: StorageRestoreInput
): Promise<StoragePullResult> {
	if (input)
		return downloadSnapshot(store, input.snapshotKey, normalizeStoragePaths([input.path])[0]);
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
				.filter(
					(item) => item.key.startsWith(`${snapshotPrefix}snapshots/`) && item.key.endsWith('.json')
				)
				.sort((a, b) => b.key.localeCompare(a.key));
			if (manifests.length) {
				const result = await downloadSnapshot(store, manifests[0].key, entryPath);
				downloaded.push(...result.downloaded);
				skipped.push(...result.skipped);
				failed.push(...result.failed);
				continue;
			}
			const remote = (await listObjects(store, prefix)).filter((item) => !item.key.endsWith('/'));
			if (!remote.length)
				throw new Error(
					'No backup was found for this folder. Choose a backup point to restore into another folder.'
				);
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
