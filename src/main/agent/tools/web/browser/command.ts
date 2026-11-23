import type { BrowserPaneCommand } from '../../../../../shared/browser';
import { library } from '../../../../browser/library';
import { closeTab } from './close';
import { createTab } from './create';
import { pane, paneEvents, paneTabs } from './pane';

export function command(request: BrowserPaneCommand): void {
	const tab = request.targetId === undefined ? undefined : paneTabs.get(request.targetId);
	if (request.command === 'new') {
		createTab(tab?.chat ?? request.chat, tab?.owner);
		paneEvents.emit('change');
		return;
	}
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
			const address = /^https?:\/\//i.test(text) || local || /^[^\s.]+(\.[^\s.]+)+(\/\S*)?$/.test(text);
			const url = !address
				? library().search.replace('%s', encodeURIComponent(text))
				: /^https?:\/\//i.test(text)
					? text
					: `${local ? 'http' : 'https'}://${text}`;
			if (!text || !URL.canParse(url)) throw new Error('Enter a web address or search words.');
			void contents.loadURL(url).catch(() => undefined);
			break;
		}
		case 'focus':
			tab.order = ++pane.order;
			break;
		case 'close':
			closeTab(tab);
			break;
	}
	paneEvents.emit('change');
}
