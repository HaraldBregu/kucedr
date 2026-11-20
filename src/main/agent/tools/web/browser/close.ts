import { paneTabs, type BrowserTab } from './pane';

export function closeTab(tab: BrowserTab): void {
	paneTabs.delete(tab.id);
	if (tab.host && !tab.host.isDestroyed()) tab.host.contentView.removeChildView(tab.view);
	if (!tab.view.webContents.isDestroyed()) tab.view.webContents.close();
}
