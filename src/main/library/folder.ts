import { mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { libraryLocation } from '../shared/library_location';

export async function resolveLibraryFolder(
	relativePath: string,
	root = libraryLocation()
): Promise<string> {
	await mkdir(root, { recursive: true });
	const resolvedRoot = await realpath(root);
	if (path.isAbsolute(relativePath)) throw new Error('Invalid library folder path.');
	const candidate = path.resolve(resolvedRoot, relativePath || '.');
	const inside = path.relative(resolvedRoot, candidate);
	if (inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside)) {
		throw new Error('Library folder must stay inside the library.');
	}
	const resolvedFolder = await realpath(candidate);
	if (resolvedFolder !== candidate || !(await stat(resolvedFolder)).isDirectory()) {
		throw new Error('Library folder is not a regular directory.');
	}
	return resolvedFolder;
}
