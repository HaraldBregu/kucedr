import { realpath, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { libraryLocation } from '../shared/library_location';

export async function deleteLibraryEntry(
	relativePath: string,
	root = libraryLocation()
): Promise<void> {
	const resolvedRoot = await realpath(root);
	const candidate = path.resolve(resolvedRoot, relativePath);
	const lexicalRelative = path.relative(resolvedRoot, candidate);
	if (
		path.isAbsolute(relativePath) ||
		!lexicalRelative ||
		lexicalRelative === '..' ||
		lexicalRelative.startsWith(`..${path.sep}`) ||
		path.isAbsolute(lexicalRelative)
	) {
		throw new Error('Library path must stay inside the library.');
	}

	const resolvedEntry = await realpath(candidate);
	if (resolvedEntry !== candidate) throw new Error('Library symlinks cannot be deleted.');
	const metadata = await stat(resolvedEntry);
	if (metadata.isDirectory()) await rm(resolvedEntry, { recursive: true });
	else if (metadata.isFile()) await unlink(resolvedEntry);
	else throw new Error('Library path is not a file or folder.');
}
