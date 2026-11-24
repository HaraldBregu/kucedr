import { shell } from 'electron';
import { paneEvents, type BrowserTab } from './pane';

export function answerDownload(tab: BrowserTab, answer: 'save' | 'cancel' | 'dismiss' | 'show'): void {
	const download = tab.download;
	if (!download) return;
	if (answer === 'save' && download.state === 'asking') {
		tab.download = { ...download, state: 'saving' };
		download.item.resume();
	} else if (answer === 'cancel') {
		tab.download = undefined;
		if (download.state === 'asking' || download.state === 'saving') download.item.cancel();
	} else if (answer === 'dismiss' && download.state !== 'asking' && download.state !== 'saving') {
		tab.download = undefined;
	} else if (answer === 'show' && download.state === 'done') {
		shell.showItemInFolder(download.path);
	}
	paneEvents.emit('change');
}
