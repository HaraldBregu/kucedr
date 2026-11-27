import type { BrowserPaneCommand } from '../../../../../shared/browser';
import { library } from '../../../../browser/library';
import { closeTab } from './close';
import { createTab } from './create';
import { findTab } from './find';
import { workspaceTabs } from './local';
import { pane, paneEvents } from './pane';

export async function command(request: BrowserPaneCommand): Promise<void> {
	const tab = request.targetId === undefined ? undefined : findTab(request.targetId);
	if (request.command === 'new') {
		createTab(tab?.chat ?? request.chat, undefined, request.route);
		paneEvents.emit('change');
		return;
	}
	if (!tab) throw new Error('This tab is closed.');
	const contents = tab.view.webContents;
	switch (request.command) {
		case 'back':
			await tab.ready;
			contents.navigationHistory.goBack();
			break;
		case 'forward':
			await tab.ready;
			contents.navigationHistory.goForward();
			break;
		case 'reload':
			await tab.ready;
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
			if ((tab.route === 'direct' || tab.route === 'private') && !isPrivacyEnabled() && onion(new URL(url).hostname))
				throw new Error(
					(loadTranslations(getLanguage(), 'main') as unknown as { browserPane: Record<string, string> }).browserPane
						.onionOutsideTor
				);
			await tab.ready;
			void contents.loadURL(url).catch(() => undefined);
			break;
		}
		case 'focus':
			tab.order = ++pane.order;
			break;
		case 'move': {
			const strip = workspaceTabs().sort((a, b) => a.position - b.position).filter((item) => item !== tab);
			strip.splice(Math.min(request.index ?? strip.length, strip.length), 0, tab);
			strip.forEach((item, at) => (item.position = at));
			tab.order = ++pane.order;
			break;
		}
		case 'close':
			closeTab(tab);
			break;
	}
	paneEvents.emit('change');
}
