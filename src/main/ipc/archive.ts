import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import unzipper from 'unzipper';

import { resolveWorkspaceFile } from './workspace';

export async function archiveWorkspaceEntry(
	root: string,
	entryPath: string,
	action: 'compress' | 'extract'
): Promise<string> {
	const resolvedRoot = await fs.realpath(root);
	const source = await resolveWorkspaceFile(root, entryPath);
	if (path.resolve(resolvedRoot, entryPath) !== source) {
		throw new Error('Workspace symlinks cannot be archived.');
	}
	const sourceStats = await fs.stat(source);
	const relativePath = (target: string) => path.relative(resolvedRoot, target).split(path.sep).join('/');

	if (action === 'compress') {
		const sourceName = path.basename(source);
		const destinationDirectory = path.dirname(source);
		let destination = path.join(destinationDirectory, `${sourceName}.zip`);
		for (let index = 2; ; index += 1) {
			try {
				await fs.access(destination);
				destination = path.join(destinationDirectory, `${sourceName} ${index}.zip`);
			} catch {
				break;
			}
		}

		await new Promise<void>((resolve, reject) => {
			const output = createWriteStream(destination, { flags: 'wx' });
			const archive = archiver('zip', { zlib: { level: 9 } });
			output.on('close', resolve);
			output.on('error', reject);
			archive.on('error', reject);
			archive.pipe(output);
			if (sourceStats.isDirectory()) archive.directory(source, sourceName);
			else if (sourceStats.isFile()) archive.file(source, { name: sourceName });
			else {
				reject(new Error('Workspace path is not a file or folder.'));
				return;
			}
			void archive.finalize();
		});
		return relativePath(destination);
	}

	if (!sourceStats.isFile() || path.extname(source).toLowerCase() !== '.zip') {
		throw new Error('Only ZIP files can be extracted.');
	}
	const destinationDirectory = path.dirname(source);
	const archive = await unzipper.Open.file(source);
	const destinations = archive.files.map((entry) => {
		if (entry.type !== 'File' && entry.type !== 'Directory') {
			throw new Error('ZIP archives with links cannot be extracted.');
		}
		const destination = path.resolve(destinationDirectory, entry.path);
		const relativeDestination = path.relative(destinationDirectory, destination);
		if (
			relativeDestination === '..' ||
			relativeDestination.startsWith(`..${path.sep}`) ||
			path.isAbsolute(relativeDestination)
		) {
			throw new Error('ZIP archive contains a path outside the workspace.');
		}
		return { destination, entry };
	});
	for (const { destination } of destinations) {
		try {
			await fs.access(destination);
			throw new Error(`An item named "${path.basename(destination)}" already exists.`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	for (const { destination, entry } of destinations) {
		if (entry.type === 'Directory') {
			await fs.mkdir(destination, { recursive: true });
			continue;
		}
		await fs.mkdir(path.dirname(destination), { recursive: true });
		await new Promise<void>((resolve, reject) => {
			const output = createWriteStream(destination, { flags: 'wx' });
			output.on('close', resolve);
			output.on('error', reject);
			entry.stream().on('error', reject).pipe(output);
		});
	}
	return relativePath(destinationDirectory);
}
