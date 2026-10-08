import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StorageObjectStore } from './remote';
import { STORAGE_MAX_OBJECT_BYTES } from './limits';

export async function uploadFile(
	store: StorageObjectStore,
	source: string,
	key: string
): Promise<void> {
	const staging = await fs.mkdtemp(path.join(tmpdir(), 'kucedr-upload-'));
	const file = path.join(staging, 'file');
	try {
		const original = await fs.lstat(source);
		if (!original.isFile() || original.isSymbolicLink())
			throw new Error('Upload source is not a regular file.');
		await fs.copyFile(source, file);
		if (store.putFile) await store.putFile(key, file);
		else {
			if ((await fs.stat(file)).size > STORAGE_MAX_OBJECT_BYTES)
				throw new Error('This storage does not support streamed file uploads.');
			await store.put(key, await fs.readFile(file));
		}
	} finally {
		await fs.rm(staging, { recursive: true, force: true });
	}
}
