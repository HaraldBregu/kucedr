import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { authLinks } from './cloud/links';
import { pluginLinks } from './plugins/plugins_link';
import { setStartupProxy } from './privacy/launch';
import { getPrivacyRoute, isPrivacyEnabled } from './privacy/state';

setStartupProxy();

if (process.defaultApp && process.argv[1]) {
	app.setAsDefaultProtocolClient('kucedr', process.execPath, [path.resolve(process.argv[1])]);
} else {
	app.setAsDefaultProtocolClient('kucedr');
}

if (!authLinks.pushArguments(process.argv)) pluginLinks.pushArguments(process.argv);
app.on('open-url', (event, url) => {
	event.preventDefault();
	if (!authLinks.push(url)) pluginLinks.push(url);
});

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on('second-instance', (_event, commandLine) => {
		if (authLinks.pushArguments(commandLine) || pluginLinks.pushArguments(commandLine)) return;
		const existingWindow = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
		if (!existingWindow) return;
		if (existingWindow.isMinimized()) existingWindow.restore();
		if (!existingWindow.isVisible()) existingWindow.show();
		existingWindow.focus();
	});

	void (async () => {
		if (isPrivacyEnabled()) {
			const { installPrivacyTransport } = await import('./privacy/transport');
			installPrivacyTransport(getPrivacyRoute());
		}
		await import('./runtime');
	})().catch((error: unknown) => {
		dialog.showErrorBox('Kucedr could not start', error instanceof Error ? error.message : String(error));
		app.exit(1);
	});
}
