import type { WebContents } from 'electron';
import { paneTabs, type BrowserTab } from './pane';

export function tabFor(contents: WebContents | undefined): BrowserTab | undefined {
	if (!contents) return undefined;
	for (const tab of paneTabs.values()) if (tab.view.webContents === contents) return tab;
	return undefined;
}
