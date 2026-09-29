import { realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { libraryLocation } from '../shared/library_location';

export async function deleteLibraryFile(
	relativePath: string,
	root = libraryLocation()
): Promise<void> {
	const resolvedRoot = await realpath(root);
	const candidate = path.resolve(resolvedRoot, relativePath);
	const lexicalRelative = path.relative(resolvedRoot, candidate);
	if (
		!lexicalRelative ||
		lexicalRelative === '..' ||
		lexicalRelative.startsWith(`..${path.sep}`) ||
		path.isAbsolute(lexicalRelative)
	) {
		throw new Error('Library file path must stay inside the library.');
	}

	const resolvedFile = await realpath(candidate);
	if (resolvedFile !== candidate) throw new Error('Library symlinks cannot be deleted.');
	const metadata = await stat(resolvedFile);
	if (!metadata.isFile()) throw new Error('Library path is not a file.');
	await unlink(resolvedFile);
}
