import fs from 'node:fs/promises';
import path from 'node:path';
import type { Config } from '../agent/types';
import { atomicWrite } from '../shared/atomic_write';
import { memoryPath, MEMORY_FILE } from './path';

export async function migrateWorkspaceMemory(config: Config): Promise<void> {
	const legacy = path.join(path.resolve(config.location), MEMORY_FILE);
	const target = memoryPath();
	let legacyContent: string;
	try {
		legacyContent = await fs.readFile(legacy, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}
	await fs.mkdir(path.dirname(target), { recursive: true });
	let targetExists = true;
	try {
		await fs.access(target);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		targetExists = false;
	}
	if (!targetExists) {
		try {
			await fs.rename(legacy, target);
			return;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
		}
	}
	let current = '';
	try {
		current = await fs.readFile(target, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (!current) {
		await atomicWrite(target, legacyContent);
	} else if (legacyContent.trim() && !current.includes(legacyContent.trim())) {
		const separator = current.endsWith('\n') ? '\n' : '\n\n';
		await atomicWrite(target, `${current}${separator}${legacyContent}`);
	}
	await fs.unlink(legacy);
}
