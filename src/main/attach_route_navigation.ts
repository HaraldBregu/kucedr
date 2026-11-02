import type { BrowserWindow, WebContents } from 'electron';

export function attachRouteNavigation(
	win: BrowserWindow,
	getContents: () => WebContents | undefined = () => win.webContents
): void {
	const navigate = (offset: -1 | 1): void => {
		const history = getContents()?.navigationHistory;
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
