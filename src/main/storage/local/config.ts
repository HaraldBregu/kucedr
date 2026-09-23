import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storageLocation } from './paths';
import type { StorageConfig } from './types';
import { normalizeStorageConfig } from './validate';

export async function readStorageConfig(): Promise<StorageConfig | undefined> {
	let text: string;
	try {
		text = await fs.readFile(path.join(storageLocation(), 'config.json'), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
	return normalizeStorageConfig(JSON.parse(text) as StorageConfig);
}
