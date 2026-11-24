import { app, BrowserWindow, dialog } from 'electron';
import path from 'node:path';
import { authLinks } from './cloud/links';
import { launchPrivacy } from './privacy/launch';
import { getPrivacyRoute, isPrivacyEnabled } from './privacy/state';
import { verifySandbox } from './privacy/verify';

if (!launchPrivacy()) {
	if (process.defaultApp && process.argv[1]) {
		app.setAsDefaultProtocolClient('kucedr', process.execPath, [path.resolve(process.argv[1])]);
	} else {
		app.setAsDefaultProtocolClient('kucedr');
	}

	authLinks.pushArguments(process.argv);
	app.on('open-url', (event, url) => {
		event.preventDefault();
		authLinks.push(url);
	});

	if (!app.requestSingleInstanceLock()) {
		app.quit();
	} else {
		app.on('second-instance', (_event, commandLine) => {
			if (authLinks.pushArguments(commandLine)) return;
			const existingWindow = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
			if (!existingWindow) return;
			if (existingWindow.isMinimized()) existingWindow.restore();
			if (!existingWindow.isVisible()) existingWindow.show();
			existingWindow.focus();
		});

		void (async () => {
			if (isPrivacyEnabled()) {
				if (!(await verifySandbox())) {
					app.exit(1);
					return;
				}
				const { installPrivacyTransport } = await import('./privacy/transport');
				installPrivacyTransport(getPrivacyRoute());
			}
			await import('./runtime');
		})().catch((error: unknown) => {
			dialog.showErrorBox('Kucedr could not start', error instanceof Error ? error.message : String(error));
			app.exit(1);
		});
	}
}
