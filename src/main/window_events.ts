import type { BrowserWindow, WebContents } from 'electron';
import { WindowChannels } from '../shared/ipc_channels_definitions';

export function attachWindowHandlers(
	win: BrowserWindow,
	contents: WebContents[] = [win.webContents]
): void {
	for (const webContents of contents) {
		webContents.on('update-target-url', () => {});
		attachTextMenu(webContents);
	}

	const send = (channel: string, value: boolean): void => {
		for (const webContents of contents) {
			if (!webContents.isDestroyed()) webContents.send(channel, value);
		}
	};

	win.on('maximize', () => send(WindowChannels.maximizeChange, true));
	win.on('unmaximize', () => send(WindowChannels.maximizeChange, false));
	win.on('enter-full-screen', () => send(WindowChannels.fullScreenChange, true));
	win.on('leave-full-screen', () => send(WindowChannels.fullScreenChange, false));
}
