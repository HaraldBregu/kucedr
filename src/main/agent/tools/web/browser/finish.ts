import { app } from 'electron';
import { copyFileSync, existsSync, renameSync } from 'node:fs';
import path from 'node:path';
import { discardDownload } from './discard';
import { paneEvents, type BrowserTab } from './pane';

function freePath(folder: string, name: string): string {
	const extension = path.extname(name);
	const stem = name.slice(0, name.length - extension.length);
	let candidate = path.join(folder, name);
	for (let copy = 1; existsSync(candidate); copy++) candidate = path.join(folder, `${stem} (${copy})${extension}`);
	return candidate;
}

// Moves an agreed, fully received download from its holding folder into Downloads.
export function finishDownload(tab: BrowserTab): void {
	const download = tab.download;
	if (!download) return;
	try {
		const target = freePath(app.getPath('downloads'), download.file);
		try {
			renameSync(download.path, target);
		} catch {
			copyFileSync(download.path, target);
		}
		discardDownload(download.path);
		tab.download = { ...download, path: target, file: path.basename(target), state: 'done' };
	} catch {
		tab.download = { ...download, state: 'failed' };
	}
	paneEvents.emit('change');
}
