import { shell } from 'electron';
import { discardDownload } from './discard';
import { finishDownload } from './finish';
import { paneEvents, type BrowserTab } from './pane';

export function answerDownload(tab: BrowserTab, answer: 'save' | 'cancel' | 'dismiss' | 'show'): void {
	const download = tab.download;
	if (!download) return;
	if (answer === 'save' && download.state === 'asking') {
		tab.download = { ...download, state: 'saving' };
		if (download.received) return finishDownload(tab);
		download.item.resume();
	} else if (answer === 'cancel' && (download.state === 'asking' || download.state === 'saving')) {
		tab.download = undefined;
		if (download.received) rmSync(path.dirname(download.path), { recursive: true, force: true });
		else download.item.cancel();
	} else if (answer === 'dismiss' && (download.state === 'done' || download.state === 'failed')) {
		tab.download = undefined;
	} else if (answer === 'show' && download.state === 'done') {
		shell.showItemInFolder(download.path);
	}
	paneEvents.emit('change');
}
