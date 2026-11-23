import type { BrowserTab } from '../agent/tools/web/browser/pane';

export async function wake(tab: BrowserTab): Promise<void> {
	if (!tab.pending) return;
	const { entries, index } = tab.pending;
	tab.pending = undefined;
	await tab.view.webContents.navigationHistory.restore({ entries, index }).catch(() => undefined);
}
