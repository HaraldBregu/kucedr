import type { BrowserTab } from '../agent/tools/web/browser/pane';

export async function wake(tab: BrowserTab): Promise<void> {
	await tab.ready;
	if (!tab.pending) return;
	const contents = tab.view.webContents;
	if (contents.isDestroyed()) return;
	const { entries, index } = tab.pending;
	tab.pending = undefined;
	await contents.navigationHistory.restore({ entries, index }).catch(() => undefined);
}
