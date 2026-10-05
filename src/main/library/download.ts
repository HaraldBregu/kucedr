import { copyFile, mkdir, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { dialog, type BrowserWindow } from 'electron';
import { libraryLocation } from '../shared/library_location';

export async function downloadLibraryFiles(
	window: BrowserWindow,
	relativePaths: string[],
	root = libraryLocation()
): Promise<boolean> {
	if (relativePaths.length === 0) return false;
	const resolvedRoot = await realpath(root);
	const files = await Promise.all(
		relativePaths.map(async (relativePath) => {
			const candidate = path.resolve(resolvedRoot, relativePath);
			const inside = path.relative(resolvedRoot, candidate);
			if (
				!inside ||
				inside === '..' ||
				inside.startsWith(`..${path.sep}`) ||
				path.isAbsolute(inside)
			) {
				throw new Error('Library file path must stay inside the library.');
			}
			const source = await realpath(candidate);
			if (source !== candidate || !(await stat(source)).isFile()) {
				throw new Error('Library path is not a regular file.');
			}
			return { source, relativePath: inside };
		})
	);
	if (files.length === 1) {
		const result = await dialog.showSaveDialog(window, {
			defaultPath: path.basename(files[0].source),
		});
		if (result.canceled || !result.filePath) return false;
		await copyFile(files[0].source, result.filePath, constants.COPYFILE_EXCL);
		return true;
	}
	const result = await dialog.showOpenDialog(window, {
		properties: ['openDirectory', 'createDirectory'],
	});
	if (result.canceled || !result.filePaths[0]) return false;
	for (const file of files) {
		const destination = path.join(result.filePaths[0], file.relativePath);
		await mkdir(path.dirname(destination), { recursive: true });
		await copyFile(file.source, destination, constants.COPYFILE_EXCL);
	}
	return true;
}
