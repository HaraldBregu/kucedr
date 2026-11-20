import { screen, type BrowserWindow } from 'electron';
import { paneShown, type BrowserTab } from './pane';

// The tab shown in this window's pane when the pointer is over the pane, else undefined.
// ponytail: the pane is the full-height column above and including the page view (tab strip and
// toolbar sit right above it); pass the pane's own rectangle from the renderer if that changes.
export function paneTabUnderPointer(win: BrowserWindow): BrowserTab | undefined {
	const content = win.getContentBounds();
	const pointer = screen.getCursorScreenPoint();
	const x = pointer.x - content.x;
	const y = pointer.y - content.y;
	for (const tab of paneShown.values()) {
		if (tab.host !== win || tab.view.webContents.isDestroyed() || !tab.view.getVisible()) continue;
		const view = tab.view.getBounds();
		if (x >= view.x && x < view.x + view.width && y >= 0 && y < view.y + view.height) return tab;
	}
	return undefined;
}
