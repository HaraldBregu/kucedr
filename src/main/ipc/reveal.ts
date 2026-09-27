import fs from 'node:fs/promises';
import { shell } from 'electron';
import { resolveWorkspaceFile } from './workspace';

export async function revealWorkspaceEntry(root: string, entryPath: string): Promise<void> {
	const resolvedPath = await resolveWorkspaceFile(root, entryPath);
	const stats = await fs.stat(resolvedPath);
	if (!stats.isFile() && !stats.isDirectory()) throw new Error('Workspace path is not a file or folder.');
	shell.showItemInFolder(resolvedPath);
}
