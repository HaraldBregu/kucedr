import { constants } from 'node:fs';
import { copyFile, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LibraryFile } from '../../shared/library_types';
import { libraryLocation } from '../shared/library_location';

export async function addLibraryFile(
	sourcePath: string,
	root = libraryLocation()
): Promise<LibraryFile> {
	await mkdir(root, { recursive: true });
	const source = await realpath(sourcePath);
	const sourceMetadata = await stat(source);
	if (!sourceMetadata.isFile()) throw new Error('Only files can be added to the library.');

	const resolvedRoot = await realpath(root);
	if (source.startsWith(`${resolvedRoot}${path.sep}`)) {
		return {
			name: path.basename(source),
			path: source,
			relativePath: path.relative(resolvedRoot, source),
			size: sourceMetadata.size,
			modifiedAt: sourceMetadata.mtime.toISOString(),
		};
	}

	const extension = path.extname(source);
	const stem = path.basename(source, extension);
	let suffix = 1;
	while (true) {
		const name = suffix === 1 ? `${stem}${extension}` : `${stem} (${suffix})${extension}`;
		const destination = path.join(resolvedRoot, name);
		try {
			await copyFile(source, destination, constants.COPYFILE_EXCL);
			const metadata = await stat(destination);
			return {
				name,
				path: destination,
				relativePath: name,
				size: metadata.size,
				modifiedAt: metadata.mtime.toISOString(),
			};
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			suffix += 1;
		}
	}
}
