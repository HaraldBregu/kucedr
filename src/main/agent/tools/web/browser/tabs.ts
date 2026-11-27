import type { BrowserPaneState, BrowserPaneTab } from '../../../../../shared/browser';
import { workspaceTabs } from './local';
import { acting } from './pane';

export function tabs(): BrowserPaneState {
	const list: BrowserPaneTab[] = [];
	for (const tab of workspaceTabs().sort((a, b) => a.position - b.position)) {
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
			route: tab.route,
			...(tab.error ? { error: tab.error } : {}),
			...(tab.blocked.length ? { blocked: [...tab.blocked] } : {}),
			...(tab.trackers ? { trackers: tab.trackers } : {}),
			...(tab.download
				? { download: { file: tab.download.file, site: tab.download.site, state: tab.download.state } }
				: {}),
			...(tab.permission ? { permission: { site: tab.permission.site, kinds: [...tab.permission.kinds] } } : {}),
			...(tab.icon ? { icon: tab.icon } : {}),
			...(tab.offer
				? { offer: { username: tab.offer.username, site: new URL(tab.offer.url).host, update: tab.offer.update } }
				: {}),
		});
	}
	return { tabs: list, acting: [...acting.keys()] };
}
