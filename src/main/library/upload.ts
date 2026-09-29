import type { LibraryFile } from '../../shared/library_types';
import { addLibraryFile } from './add';

export async function addLibraryFiles(paths: readonly string[]): Promise<LibraryFile[]> {
	const files: LibraryFile[] = [];
	for (const path of paths) files.push(await addLibraryFile(path));
	return files;
}
