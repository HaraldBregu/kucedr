import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveWorkspaceFile } from './workspace';

export async function copyIntoWorkspace(
	root: string,
	destinationDirectoryPath: string,
	sources: string[]
): Promise<string[]> {
	const resolvedRoot = await fs.realpath(root);
	const resolvedDestination = await resolveWorkspaceFile(root, destinationDirectoryPath || '.');
	if (path.resolve(resolvedRoot, destinationDirectoryPath || '.') !== resolvedDestination) {
		throw new Error('Workspace symlinks cannot be used as import destinations.');
	}
	if (!(await fs.stat(resolvedDestination)).isDirectory()) {
		throw new Error('Import destination is not a folder.');
	}
	const imported: string[] = [];
	for (const source of sources) {
		const targetPath = path.join(resolvedDestination, path.basename(source));
		try {
			await fs.lstat(targetPath);
			throw new Error(`An item named "${path.basename(source)}" already exists.`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		await fs.cp(source, targetPath, { recursive: true, errorOnExist: true, force: false });
		imported.push(path.relative(resolvedRoot, targetPath).split(path.sep).join('/'));
	}
	return imported;
}
