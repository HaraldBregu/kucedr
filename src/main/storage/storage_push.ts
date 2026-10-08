import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StoragePushResult } from '../../shared/storage_types';
import { describeStorageError } from './storage_error';
import { normalizeStoragePaths } from './storage_paths';
import { storagePrefix } from './storage_prefix';
import type { StorageObjectStore } from './remote';
import { getStorageSettings } from './storage_store';
import { walkFiles } from './storage_walk';
import { uploadFile } from './upload';

export async function pushFiles(store: StorageObjectStore): Promise<StoragePushResult> {
	const paths = normalizeStoragePaths(getStorageSettings().paths);
	if (!paths.length) throw new Error('Select at least one folder to upload.');
	const uploaded: string[] = [];
	const failed: StoragePushResult['failed'] = [];
	for (const root of paths) {
		try {
			const stat = await fs.lstat(root);
			if (stat.isSymbolicLink()) throw new Error(`Selected path is a symbolic link: ${root}`);
			const prefix = storagePrefix(root);
			const sources = stat.isDirectory() ? await walkFiles(root) : [root];
			for (const source of sources) {
				try {
					const key = stat.isDirectory()
						? `${prefix}${path.relative(root, source).split(path.sep).join('/')}`
						: path.basename(root);
					await uploadFile(store, source, key);
					uploaded.push(source);
				} catch (error) {
					failed.push({ path: source, error: describeStorageError(error) });
				}
			}
		} catch (error) {
			failed.push({ path: root, error: describeStorageError(error) });
		}
	}
	return { uploaded, failed };
}
