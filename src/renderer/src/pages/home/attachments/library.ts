import type { LibraryFile } from '@shared/library_types';

export async function droppedLibraryFiles(payload: string): Promise<LibraryFile[]> {
	const paths: unknown = JSON.parse(payload);
	if (!Array.isArray(paths) || !paths.length || !paths.every((path) => typeof path === 'string')) return [];
	const files = await window.library.list();
	return files.filter((file) => file.kind !== 'folder' && paths.includes(file.relativePath));
}
