import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { LibraryFile } from '../../shared/library_types';
import { libraryLocation } from '../shared/library_location';

export async function listLibraryFiles(root = libraryLocation()): Promise<LibraryFile[]> {
	await mkdir(root, { recursive: true });
	const directories = [root];
	const files: LibraryFile[] = [];

	while (directories.length > 0) {
		const directory = directories.pop();
		if (!directory) continue;

		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const absolutePath = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				directories.push(absolutePath);
				continue;
			}
			if (!entry.isFile()) continue;

			const metadata = await stat(absolutePath);
			files.push({
				name: entry.name,
				path: absolutePath,
				relativePath: path.relative(root, absolutePath),
				size: metadata.size,
				modifiedAt: metadata.mtime.toISOString(),
			});
		}
	}

	return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
