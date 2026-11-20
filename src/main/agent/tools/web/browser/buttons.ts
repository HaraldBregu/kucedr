import type { WebContents } from 'electron';

const WORLD = 4119;

// On macOS the mouse's back and forward buttons over the page go to the page's own view, which
// the app's window never sees. A listener in Kucedr's private script world moves the tab's
// history instead. Windows and Linux report the buttons to the window (attach_route_navigation).
const SCRIPT = `(() => {
	if (window.__kucedrButtons) return;
	window.__kucedrButtons = true;
	const handle = (event) => {
		if (!event.isTrusted || (event.button !== 3 && event.button !== 4)) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (event.type === 'mouseup') event.button === 3 ? history.back() : history.forward();
	};
	window.addEventListener('mousedown', handle, true);
	window.addEventListener('mouseup', handle, true);
})()`;

export function watchMouseButtons(contents: WebContents): void {
	if (process.platform !== 'darwin') return;
	contents.on('dom-ready', () => {
		void contents.executeJavaScriptInIsolatedWorld(WORLD, [{ code: SCRIPT }]).catch(() => undefined);
	});
}
