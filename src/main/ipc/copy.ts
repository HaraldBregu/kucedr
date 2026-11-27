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
		if (!path.isAbsolute(source)) throw new Error('Invalid import source path.');
		const extension = (await fs.stat(source)).isFile() ? path.extname(source) : '';
		const baseName = path.basename(source, extension);
		let targetPath = path.join(resolvedDestination, path.basename(source));
		for (let index = 1; ; index += 1) {
			try {
				await fs.lstat(targetPath);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
				break;
			}
			const suffix = index === 1 ? ' copy' : ` copy ${index}`;
			targetPath = path.join(resolvedDestination, `${baseName}${suffix}${extension}`);
		}
		await fs.cp(source, targetPath, { recursive: true, errorOnExist: true, force: false });
		imported.push(path.relative(resolvedRoot, targetPath).split(path.sep).join('/'));
	}
	return imported;
}
