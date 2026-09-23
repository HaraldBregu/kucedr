import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storageLocation } from './paths';
import type { StorageConfig } from './types';
import { normalizeStorageConfig } from './validate';

export async function writeStorageConfig(config: StorageConfig): Promise<void> {
	const safe = normalizeStorageConfig(config);
	const root = storageLocation();
	await fs.mkdir(root, { recursive: true, mode: 0o700 });
	const temporary = path.join(root, `config.${randomUUID()}.tmp`);
	try {
		const handle = await fs.open(temporary, 'wx', 0o600);
		try {
			await handle.writeFile(JSON.stringify(safe, null, 2));
			await handle.sync();
		} finally {
			await handle.close();
		}
		await fs.rename(temporary, path.join(root, 'config.json'));
		const dir = await fs.open(root, 'r');
		try {
			await dir.sync();
		} finally {
			await dir.close();
		}
	} finally {
		await fs.rm(temporary, { force: true });
	}
}
