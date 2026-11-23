import type { BrowserPaneState, BrowserPaneTab } from '../../../../../shared/browser';
import { acting, paneTabs } from './pane';

export function tabs(): BrowserPaneState {
	const list: BrowserPaneTab[] = [];
	for (const tab of paneTabs.values()) {
		const contents = tab.view.webContents;
		if (tab.chat === undefined || contents.isDestroyed()) continue;
		const pending = tab.pending?.entries[tab.pending.index];
		list.push({
			targetId: tab.id,
			chat: tab.chat,
			url: pending?.url ?? contents.getURL(),
			title: pending?.title ?? contents.getTitle(),
			loading: contents.isLoading(),
			order: tab.order,
			back: contents.navigationHistory.canGoBack(),
			forward: contents.navigationHistory.canGoForward(),
			...(tab.error ? { error: tab.error } : {}),
			...(tab.icon ? { icon: tab.icon } : {}),
			...(tab.offer
				? { offer: { username: tab.offer.username, site: new URL(tab.offer.url).host, update: tab.offer.update } }
				: {}),
		});
	}
	return { tabs: list, acting: [...acting.keys()] };
}
