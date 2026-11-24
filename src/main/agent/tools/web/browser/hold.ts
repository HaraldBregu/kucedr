import { app, type DownloadItem, type Event, type WebContents } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { BrowserRoute } from '../../../../../shared/browser';
import { block } from './block';
import { tabFor } from './owner';
import { paneEvents } from './pane';

function freePath(folder: string, name: string): string {
	const extension = path.extname(name);
	const stem = name.slice(0, name.length - extension.length);
	let candidate = path.join(folder, name);
	for (let copy = 1; existsSync(candidate); copy++) candidate = path.join(folder, `${stem} (${copy})${extension}`);
	return candidate;
}

// A download starts paused in the Downloads folder and waits for the user's answer in the pane,
// whoever started it. Tor tabs never download.
export function holdDownload(event: Event, item: DownloadItem, contents: WebContents, route: BrowserRoute): void {
	const tab = tabFor(contents);
	if (!tab || route === 'tor') {
		event.preventDefault();
		if (tab) block(tab, item.getURL(), 'download');
		return;
	}
	const file = freePath(app.getPath('downloads'), path.basename(item.getFilename()) || 'download');
	item.setSavePath(file);
	item.pause();
	if (tab.download?.state === 'asking') tab.download.item.cancel();
	const site = URL.canParse(item.getURL()) ? new URL(item.getURL()).host : '';
	tab.download = { item, path: file, file: path.basename(file), site, state: 'asking' };
	item.once('done', (_event, state) => {
		if (tab.download?.item !== item) return;
		tab.download =
			state === 'cancelled' ? undefined : { ...tab.download, state: state === 'completed' ? 'done' : 'failed' };
		paneEvents.emit('change');
	});
	paneEvents.emit('change');
}
