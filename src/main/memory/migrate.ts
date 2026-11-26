import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import type { Workspace } from '../workspaces/types';
import { atomicWrite } from '../shared/atomic_write';
import { seal } from '../vault/seal';
import { unseal } from '../vault/unseal';
import { memoryPath, MEMORY_FILE } from './path';

export async function migrateWorkspaceMemory(workspace: Workspace): Promise<void> {
	if (workspace.id !== DEFAULT_WORKSPACE) return;
	const legacy = path.join(path.resolve(workspace.files), MEMORY_FILE);
	const target = memoryPath(workspace);
	if (legacy === target) return;
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
		current = unseal(await fs.readFile(target)).toString('utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (!current) {
		await atomicWrite(target, seal(legacyContent));
	} else if (legacyContent.trim() && !current.includes(legacyContent.trim())) {
		const separator = current.endsWith('\n') ? '\n' : '\n\n';
		await atomicWrite(target, seal(`${current}${separator}${legacyContent}`));
	}
	await fs.unlink(legacy);
}
