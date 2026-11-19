import type { BrowserPaneCommand } from '../../../../../shared/browser';
import { pageOrder, pane, paneEvents } from './pane';
import { interactive } from './session';

export async function command(request: BrowserPaneCommand): Promise<void> {
	const page = interactive.pages.get(request.targetId);
	if (!page) throw new Error('This tab is closed.');
	switch (request.command) {
		case 'back':
			await page.goBack({ waitUntil: 'commit' });
			break;
		case 'forward':
			await page.goForward({ waitUntil: 'commit' });
			break;
		case 'reload':
			await page.reload({ waitUntil: 'commit' });
			break;
		case 'stop': {
			const cdp = await page.context().newCDPSession(page);
			await cdp.send('Page.stopLoading').finally(() => cdp.detach());
			break;
		}
		case 'navigate': {
			const text = request.url?.trim() ?? '';
			const local = /^(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/i.test(text);
			const url = /^https?:\/\//i.test(text) ? text : `${local ? 'http' : 'https'}://${text}`;
			if (!URL.canParse(url)) throw new Error('Enter a web address, for example example.com.');
			await page.goto(url, { waitUntil: 'commit' });
			break;
		}
		case 'focus':
			pageOrder.set(page, ++pane.order);
			break;
	}
	paneEvents.emit('change');
}
