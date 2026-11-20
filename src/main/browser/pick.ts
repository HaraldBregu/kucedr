import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { BrowserImportPick } from '../../shared/browser_import';
import { discover } from './discover';
import { profileFiles } from './files';
import { SEARCH_DEPTH } from './sources';

const LOOSE_FILE_LIMIT = 200;

// Lets the user point at anything: a browser's folder, one profile, or exported files.
// A folder is searched for profiles first; failing that, the files directly in it are tried.
export async function pickFiles(window: BrowserWindow | null, request: BrowserImportPick): Promise<string[] | null> {
	const options: OpenDialogOptions = {
		properties: request.folder
			? ['openDirectory', 'showHiddenFiles']
			: process.platform === 'darwin'
				? ['openFile', 'openDirectory', 'multiSelections', 'showHiddenFiles']
				: ['openFile', 'multiSelections', 'showHiddenFiles'],
	};
	const result = await (window ? dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options));
	if (result.canceled) return null;
	const files: string[] = [];
	for (const chosen of result.filePaths) {
		if (!statSync(chosen).isDirectory()) {
			files.push(chosen);
			continue;
		}
		const profiles = await discover(chosen, SEARCH_DEPTH);
		const inside = (profiles.length ? profiles : [chosen]).flatMap((directory) => profileFiles(directory, request));
		files.push(
			...(inside.length
				? inside
				: readdirSync(chosen, { withFileTypes: true })
						.filter((entry) => entry.isFile())
						.slice(0, LOOSE_FILE_LIMIT)
						.map((entry) => path.join(chosen, entry.name)))
		);
	}
	return files;
}
