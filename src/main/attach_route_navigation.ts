import type { BrowserWindow, WebContents } from 'electron';
import { paneTabUnderPointer } from './agent/tools/web/browser/under';

export function attachRouteNavigation(
	win: BrowserWindow,
	getContents: () => WebContents | undefined = () => win.webContents
): void {
	// With the pointer over the browser pane the tab moves, and the app never does in its place.
	const navigate = (offset: -1 | 1): void => {
		const history = (paneTabUnderPointer(win)?.view.webContents ?? getContents())?.navigationHistory;
		if (offset === -1 && history?.canGoBack()) history.goBack();
		if (offset === 1 && history?.canGoForward()) history.goForward();
	};

	win.on('app-command', (_event, command) => {
		if (command === 'browser-backward') navigate(-1);
		if (command === 'browser-forward') navigate(1);
	});

	win.on('swipe', (_event, direction) => {
		if (direction === 'left') navigate(-1);
		if (direction === 'right') navigate(1);
	});
}
