import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { currentWorkspace } from '../workspaces/current';
import { resolveLibraryFolder } from './folder';

export async function createLibraryFolder(
	name: string,
	root = currentWorkspace().library,
	parent = ''
): Promise<void> {
	const folderName = name.trim();
	if (!folderName || folderName === '.' || folderName === '..' || /[\\/:\0]/.test(folderName)) {
		throw new Error('Invalid library folder name.');
	}
	const destination = await resolveLibraryFolder(parent, root);
	await mkdir(path.join(destination, folderName));
}
