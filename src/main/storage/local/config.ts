import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storageLocation } from './paths';
import type { StorageConfig } from './types';

export async function readStorageConfig(): Promise<StorageConfig | undefined> {
	let text: string;
	try {
		text = await fs.readFile(path.join(storageLocation(), 'config.json'), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw error;
	}
	const config = JSON.parse(text) as StorageConfig;
	if (config.version !== 1) throw new Error('Unsupported storage configuration version.');
	return config;
}
