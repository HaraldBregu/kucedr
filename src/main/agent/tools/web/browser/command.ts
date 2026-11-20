import type { BrowserPaneCommand } from '../../../../../shared/browser';
import { closeTab } from './close';
import { createTab } from './create';
import { pane, paneEvents, paneTabs } from './pane';

export function command(request: BrowserPaneCommand): void {
	const tab = paneTabs.get(request.targetId);
	if (!tab) throw new Error('This tab is closed.');
	const contents = tab.view.webContents;
	switch (request.command) {
		case 'back':
			contents.navigationHistory.goBack();
			break;
		case 'forward':
			contents.navigationHistory.goForward();
			break;
		case 'reload':
			contents.reload();
			break;
		case 'stop':
			contents.stop();
			break;
		case 'navigate': {
			const text = request.url?.trim() ?? '';
			const local = /^(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(text);
			const url = /^https?:\/\//i.test(text) ? text : `${local ? 'http' : 'https'}://${text}`;
			if (!URL.canParse(url)) throw new Error('Enter a web address, for example example.com.');
			void contents.loadURL(url).catch(() => undefined);
			break;
		}
		case 'focus':
			tab.order = ++pane.order;
			break;
		case 'close':
			closeTab(tab);
			break;
		case 'new':
			createTab(tab.chat, tab.owner);
			break;
	}
	paneEvents.emit('change');
}
