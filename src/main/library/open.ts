import { mkdir } from 'node:fs/promises';
import { shell } from 'electron';
import { currentWorkspace } from '../workspaces/current';

export async function openLibraryRoot(root = currentWorkspace().library): Promise<void> {
	await mkdir(root, { recursive: true });
	const error = await shell.openPath(root);
	if (error) throw new Error(error);
}
