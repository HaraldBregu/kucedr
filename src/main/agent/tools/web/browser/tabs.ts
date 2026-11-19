import type { BrowserPaneState, BrowserPaneTab } from '../../../../../shared/browser';
import { acting, pageChats, pageLoading, pageOrder } from './pane';
import { interactive } from './session';

export async function tabs(): Promise<BrowserPaneState> {
	const list: BrowserPaneTab[] = [];
	for (const [targetId, page] of interactive.pages) {
		const chat = pageChats.get(page);
		if (chat === undefined) continue;
		list.push({
			targetId,
			chat,
			url: page.url(),
			title: await page.title().catch(() => ''),
			loading: pageLoading.has(page),
			order: pageOrder.get(page) ?? 0,
		});
	}
	return { tabs: list, acting: [...acting.keys()] };
}
