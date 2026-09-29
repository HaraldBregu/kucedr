import { mkdir } from 'node:fs/promises';
import { shell } from 'electron';
import { libraryLocation } from '../shared/library_location';

export async function openLibraryRoot(root = libraryLocation()): Promise<void> {
	await mkdir(root, { recursive: true });
	const error = await shell.openPath(root);
	if (error) throw new Error(error);
}
