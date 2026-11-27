import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveWorkspaceFile } from './workspace';

// ponytail: relative Markdown links to files left behind are not rewritten
export async function transferWorkspaceEntry(
	root: string,
	sourcePath: string,
	targetRoot: string
): Promise<void> {
	const resolvedRoot = await fs.realpath(root);
	const resolvedSource = await resolveWorkspaceFile(root, sourcePath);
	if (path.resolve(resolvedRoot, sourcePath) !== resolvedSource) {
		throw new Error('Workspace symlinks cannot be moved.');
	}
	if (resolvedSource === resolvedRoot) throw new Error('The workspace root cannot be moved.');

	const sourceStats = await fs.stat(resolvedSource);
	if (!sourceStats.isFile() && !sourceStats.isDirectory()) {
		throw new Error('Workspace path is not a file or folder.');
	}

	const targetPath = path.join(await fs.realpath(targetRoot), path.basename(resolvedSource));
	try {
		await fs.lstat(targetPath);
		throw new Error(`An item named "${path.basename(resolvedSource)}" already exists.`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}

	try {
		await fs.rename(resolvedSource, targetPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
		await fs.cp(resolvedSource, targetPath, { recursive: true, errorOnExist: true, force: false });
		await fs.rm(resolvedSource, { recursive: true });
	}
}
