import type { BrowserWindow } from 'electron';

const crashLoopMs = 10_000;

export function reloadAfterCrash(win: BrowserWindow, isQuitting: () => boolean): void {
	let reloadedAt = 0;
	win.webContents.on('render-process-gone', (_event, details) => {
		if (details.reason === 'clean-exit' || isQuitting() || win.isDestroyed()) return;
		if (Date.now() - reloadedAt < crashLoopMs) return;
		reloadedAt = Date.now();
		win.webContents.reload();
	});
}
