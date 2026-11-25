import { acting, paneEvents, type BrowserTab } from './pane';

// Allow lasts for this origin until the tab navigates, and only while the tab still shows that
// origin and the agent is not driving it; Block and closing the bar deny this request.
export function answerPermission(tab: BrowserTab, answer: 'allow' | 'block' | 'dismiss'): void {
	const request = tab.permission;
	if (!request) return;
	tab.permission = undefined;
	const url = tab.view.webContents.isDestroyed() ? '' : tab.view.webContents.getURL();
	const allowed =
		answer === 'allow' &&
		URL.canParse(url) &&
		new URL(url).origin === request.origin &&
		!(tab.chat && acting.has(tab.chat));
	if (allowed) {
		tab.granted ??= new Set();
		for (const kind of request.kinds) tab.granted.add(`${request.origin} ${kind}`);
	}
	request.answer(allowed);
	paneEvents.emit('change');
}
