import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { libraryLocation } from '../shared/library_location';

export async function createLibraryFolder(name: string, root = libraryLocation()): Promise<void> {
	const folderName = name.trim();
	if (!folderName || folderName === '.' || folderName === '..' || /[\\/:\0]/.test(folderName)) {
		throw new Error('Invalid library folder name.');
	}
	await mkdir(root, { recursive: true });
	await mkdir(path.join(root, folderName));
}
