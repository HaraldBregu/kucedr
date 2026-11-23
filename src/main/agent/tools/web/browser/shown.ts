import { BrowserWindow } from 'electron';
import { paneShown, paneTabs, type BrowserTab } from './pane';

export function shown(): BrowserTab[] {
	const focused = BrowserWindow.getFocusedWindow()?.webContents;
	const first = focused && paneShown.get(focused);
	return [...new Set([...(first ? [first] : []), ...paneShown.values()])].filter(
		(tab) => paneTabs.has(tab.id) && !tab.view.webContents.isDestroyed()
	);
}
