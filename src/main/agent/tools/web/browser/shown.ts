import { BrowserWindow } from 'electron';
import { currentWorkspace } from '../../../../workspaces/current';
import { paneShown, paneTabs, type BrowserTab } from './pane';

export function shown(): BrowserTab[] {
	const { id } = currentWorkspace();
	const focused = BrowserWindow.getFocusedWindow()?.webContents;
	const first = focused && paneShown.get(focused);
	return [...new Set([...(first ? [first] : []), ...paneShown.values()])].filter(
		(tab) =>
			tab.workspace.id === id && paneTabs.has(tab.id) && !tab.view.webContents.isDestroyed()
	);
}
