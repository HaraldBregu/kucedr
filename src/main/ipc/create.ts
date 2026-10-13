import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveWorkspaceFile } from './workspace';
import { workspaceEntryName } from './workspace_name';

export async function createWorkspaceEntry(
	root: string,
	parentPath: string,
	name: string,
	type: 'file' | 'directory'
): Promise<string> {
	const normalizedName = workspaceEntryName(name);

	const resolvedRoot = await fs.realpath(root);
	const resolvedParent = await resolveWorkspaceFile(root, parentPath || '.');
	const parentStats = await fs.stat(resolvedParent);
	if (!parentStats.isDirectory()) throw new Error('Workspace parent path is not a folder.');

	const targetPath = path.join(resolvedParent, normalizedName);
	try {
		if (type === 'directory') await fs.mkdir(targetPath);
		else await fs.writeFile(targetPath, '', { flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`An item named "${normalizedName}" already exists.`, { cause: error });
		}
		throw error;
	}

	return path.relative(resolvedRoot, targetPath).split(path.sep).join('/');
}
