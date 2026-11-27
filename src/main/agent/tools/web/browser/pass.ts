import { acting, type BrowserTab } from './pane';

export function pass(tab: BrowserTab): void {
	const url = tab.danger;
	if (!url || (tab.chat && acting.has(tab.chat))) return;
	tab.passed ??= new Set();
	tab.passed.add(new URL(url).hostname);
	void tab.view.webContents.loadURL(url).catch(() => undefined);
}
