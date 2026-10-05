import path from 'node:path';
import type { LibraryFile } from '../../shared/library_types';
import { libraryLocation } from '../shared/library_location';
import { addLibraryFile } from './add';
import { resolveLibraryFolder } from './folder';

export async function addLibraryFiles(paths: readonly string[], destinationFolder = '', root = libraryLocation()): Promise<LibraryFile[]> {
	const destination = await resolveLibraryFolder(destinationFolder, root);
	const resolvedRoot = await resolveLibraryFolder('', root);
	const files: LibraryFile[] = [];
	for (const source of paths) {
		const file = await addLibraryFile(source, destination);
		files.push({ ...file, relativePath: path.relative(resolvedRoot, file.path) });
	}
	return files;
}
