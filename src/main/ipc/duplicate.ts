import fs from 'node:fs/promises';
import path from 'node:path';

import { resolveWorkspaceFile } from './workspace';

export async function duplicateWorkspaceFile(root: string, sourcePath: string): Promise<string> {
	const resolvedRoot = await fs.realpath(root);
	const resolvedSource = await resolveWorkspaceFile(root, sourcePath);
	if (path.resolve(resolvedRoot, sourcePath) !== resolvedSource) {
		throw new Error('Workspace symlinks cannot be duplicated.');
	}
	if (!(await fs.stat(resolvedSource)).isFile()) throw new Error('Workspace path is not a file.');

	const extension = path.extname(resolvedSource);
	const baseName = path.basename(resolvedSource, extension);
	let index = 1;
	while (true) {
		const suffix = index === 1 ? ' copy' : ` copy ${index}`;
		const targetPath = path.join(path.dirname(resolvedSource), `${baseName}${suffix}${extension}`);
		try {
			await fs.copyFile(resolvedSource, targetPath, fs.constants.COPYFILE_EXCL);
			return path.relative(resolvedRoot, targetPath).split(path.sep).join('/');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			index += 1;
		}
	}
}
