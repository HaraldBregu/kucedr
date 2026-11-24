import { app, type DownloadItem, type Event, type WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { BrowserRoute } from '../../../../../shared/browser';
import { block } from './block';
import { discardDownload } from './discard';
import { finishDownload } from './finish';
import { tabFor } from './owner';
import { paneEvents } from './pane';

// A download goes to a holding folder, paused, and reaches Downloads only when the user agrees
// in the pane, whoever started it. A small file can arrive before the answer; it then waits in
// the holding folder. Tor tabs never download.
export function holdDownload(event: Event, item: DownloadItem, contents: WebContents, route: BrowserRoute): void {
	const tab = tabFor(contents);
	if (!tab || route === 'tor') {
		event.preventDefault();
		if (tab) block(tab, item.getURL(), 'download');
		return;
	}
	const folder = path.join(app.getPath('temp'), 'kucedr-downloads', randomUUID());
	mkdirSync(folder, { recursive: true });
	const file = path.basename(item.getFilename()) || 'download';
	item.setSavePath(path.join(folder, file));
	item.pause();
	if (tab.download?.state === 'asking') {
		tab.download.item.cancel();
		rmSync(path.dirname(tab.download.path), { recursive: true, force: true });
	}
	const site = URL.canParse(item.getURL()) ? new URL(item.getURL()).host : '';
	tab.download = { item, path: path.join(folder, file), file, site, state: 'asking' };
	item.once('done', (_event, state) => {
		const current = tab.download;
		if (current?.item !== item) return;
		if (state !== 'completed') {
			tab.download = state === 'cancelled' ? undefined : { ...current, state: 'failed' };
			rmSync(folder, { recursive: true, force: true });
			paneEvents.emit('change');
		} else if (current.state === 'saving') finishDownload(tab);
		else tab.download = { ...current, received: true };
	});
	paneEvents.emit('change');
}
