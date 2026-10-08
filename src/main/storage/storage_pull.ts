import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { StoragePullResult } from '../../shared/storage_types';
import { describeStorageError } from './storage_error';
import { normalizeStoragePaths } from './storage_paths';
import { storagePrefix } from './storage_prefix';
import type { StorageObjectStore } from './remote';
import { STORAGE_MAX_OBJECT_BYTES } from './limits';
import { getStorageSettings } from './storage_store';
import { storageTarget } from './storage_target';
import { isProtectedStoragePath } from './storage_protected';

export async function pullFiles(store: StorageObjectStore): Promise<StoragePullResult> {
	const paths = normalizeStoragePaths(getStorageSettings().paths);
	if (!paths.length) throw new Error('Select at least one folder to download into.');
	const result: StoragePullResult = { downloaded: [], skipped: [], failed: [] };
	for (const root of paths) {
		try {
			await fs.mkdir(root, { recursive: true });
			if ((await fs.lstat(root)).isSymbolicLink())
				throw new Error('Selected folder is a symbolic link.');
			const prefix = storagePrefix(root);
			const objects = (await store.list(prefix)).filter((item) => !item.key.endsWith('/'));
			if (!objects.length) throw new Error(`No stored files were found in ${prefix}`);
			for (const item of objects) {
				let temporary: string | undefined;
				try {
					const target = await storageTarget(root, item.key, prefix);
					if (isProtectedStoragePath(target))
						throw new Error('Download targets a protected application folder.');
					await fs.mkdir(path.dirname(target), { recursive: true });
					temporary = `${target}.kucedr-${randomUUID()}.tmp`;
					if (store.getFile) await store.getFile(item.key, temporary);
					else {
						if (item.size > STORAGE_MAX_OBJECT_BYTES)
							throw new Error('This storage does not support streamed file downloads.');
						await fs.writeFile(temporary, await store.get(item.key), { flag: 'wx' });
					}
					if ((await fs.stat(temporary)).size !== item.size)
						throw new Error('Downloaded file size does not match storage.');
					await fs.rename(temporary, target);
					result.downloaded.push(item.key);
				} catch (error) {
					result.failed.push({ path: item.key, error: describeStorageError(error) });
				} finally {
					if (temporary) await fs.rm(temporary, { force: true });
				}
			}
		} catch (error) {
			result.failed.push({ path: root, error: describeStorageError(error) });
		}
	}
	return result;
}
