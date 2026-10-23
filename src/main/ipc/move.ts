import fs from 'node:fs/promises';
import path from 'node:path';

import { workspaceFileType } from '../../shared/workspace';
import { atomicWrite } from '../shared/atomic_write';
import { resolveWorkspaceFile } from './workspace';

export async function moveWorkspaceEntry(
	root: string,
	sourcePath: string,
	destinationDirectoryPath: string
): Promise<string> {
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

	const resolvedDestination = await resolveWorkspaceFile(root, destinationDirectoryPath || '.');
	if (path.resolve(resolvedRoot, destinationDirectoryPath || '.') !== resolvedDestination) {
		throw new Error('Workspace symlinks cannot be used as move destinations.');
	}
	const destinationStats = await fs.stat(resolvedDestination);
	if (!destinationStats.isDirectory()) throw new Error('Move destination is not a folder.');

	if (sourceStats.isDirectory()) {
		const relativeDestination = path.relative(resolvedSource, resolvedDestination);
		if (
			!relativeDestination ||
			(!relativeDestination.startsWith(`..${path.sep}`) &&
				relativeDestination !== '..' &&
				!path.isAbsolute(relativeDestination))
		) {
			throw new Error('A folder cannot be moved into itself.');
		}
	}

	const targetPath = path.join(resolvedDestination, path.basename(resolvedSource));
	if (targetPath === resolvedSource) {
		return path.relative(resolvedRoot, resolvedSource).split(path.sep).join('/');
	}

	try {
		await fs.lstat(targetPath);
		throw new Error(`An item named "${path.basename(resolvedSource)}" already exists.`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}

	await fs.rename(resolvedSource, targetPath);
	if (sourceStats.isFile() && workspaceFileType(targetPath).kind === 'markdown') {
		const content = await fs.readFile(targetPath, 'utf8');
		const rewritten = content.replace(/(\]\()([^)\s]+)/g, (match, prefix: string, link: string) => {
			if (/^([a-z][a-z\d+.-]*:|\/|#)/i.test(link)) return match;
			const absolute = path.resolve(path.dirname(resolvedSource), decodeURI(link));
			return `${prefix}${encodeURI(path.relative(resolvedDestination, absolute).split(path.sep).join('/'))}`;
		});
		if (rewritten !== content) await atomicWrite(targetPath, rewritten);
	}
	return path.relative(resolvedRoot, targetPath).split(path.sep).join('/');
}
