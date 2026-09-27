import { expect, test } from '@playwright/test';
import { rm } from 'node:fs/promises';
import { launchApp } from './helpers';

test('opens the bundled Workspace in its own window', async () => {
	const { app, page, userDataDir } = await launchApp();
	try {
		await page.evaluate(() => window.apps.open('workspace'));
		await expect.poll(() =>
			app.evaluate(({ BrowserWindow }) => {
				const win = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'Workspace');
				return win?.webContents.getURL().endsWith('/workspace.html#/app/Workspace') ?? false;
			})
		).toBe(true);
		await expect.poll(() =>
			app.evaluate(({ BrowserWindow }) => {
				const win = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'Workspace');
				return win?.contentView.children.length ?? 0;
			})
		).toBe(1);
	} finally {
		await app.close();
		await rm(userDataDir, { recursive: true, force: true });
	}
});
