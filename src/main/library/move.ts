import { lstat, mkdir, realpath, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { libraryLocation } from '../shared/library_location';

export async function moveLibraryEntries(
	relativePaths: string[],
	destinationFolder: string,
	root = libraryLocation()
): Promise<void> {
	if (relativePaths.length === 0) return;
	await mkdir(root, { recursive: true });
	const resolvedRoot = await realpath(root);
	if (path.isAbsolute(destinationFolder)) throw new Error('Invalid library destination.');
	const destination = path.resolve(resolvedRoot, destinationFolder);
	const destinationRelative = path.relative(resolvedRoot, destination);
	if (destinationRelative === '..' || destinationRelative.startsWith(`..${path.sep}`)) {
		throw new Error('Library destination must stay inside the library.');
	}
	if ((await realpath(destination)) !== destination || !(await stat(destination)).isDirectory()) {
		throw new Error('Library destination is not a regular folder.');
	}

	const moves: { source: string; target: string; isDirectory: boolean }[] = [];
	const targetNames = new Set<string>();
	for (const relativePath of relativePaths) {
		if (!relativePath || path.isAbsolute(relativePath)) throw new Error('Invalid library source.');
		const source = path.resolve(resolvedRoot, relativePath);
		const sourceRelative = path.relative(resolvedRoot, source);
		if (!sourceRelative || sourceRelative === '..' || sourceRelative.startsWith(`..${path.sep}`)) {
			throw new Error('Library source must stay inside the library.');
		}
		if ((await realpath(source)) !== source) throw new Error('Library symlinks cannot be moved.');
		const metadata = await stat(source);
		if (!metadata.isFile() && !metadata.isDirectory()) {
			throw new Error('Library source is not a file or folder.');
		}
		if (metadata.isDirectory() && (destination === source || destination.startsWith(`${source}${path.sep}`))) {
			throw new Error('A folder cannot be moved into itself.');
		}
		const target = path.join(destination, path.basename(source));
		if (target === source) continue;
		const targetName = path.basename(target).toLocaleLowerCase();
		if (targetNames.has(targetName)) throw new Error('Library destination has duplicate names.');
		targetNames.add(targetName);
		try {
			await lstat(target);
			throw new Error('An item with this name already exists in the folder.');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
		moves.push({ source, target, isDirectory: metadata.isDirectory() });
	}
	for (const move of moves) {
		if (moves.some((other) => other !== move && move.source.startsWith(`${other.source}${path.sep}`) && other.isDirectory)) {
			throw new Error('A folder and its contents cannot be moved together.');
		}
	}
	for (const move of moves) await rename(move.source, move.target);
}
