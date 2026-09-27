import { expect, test } from '@playwright/test';
import { rm } from 'node:fs/promises';
import type { WebContentsView } from 'electron';
import { launchApp } from './helpers';

test('opens the bundled Workspace in its own window', async () => {
	const { app, page, userDataDir } = await launchApp();
	try {
		await page.evaluate(() => window.apps.open('workspace'));
		await expect.poll(() =>
			app.evaluate(({ BrowserWindow }) => {
				return BrowserWindow.getAllWindows().map((window) => ({
					title: window.getTitle(),
					url: window.webContents.getURL(),
				}));
			})
		).toContainEqual(expect.objectContaining({ title: 'Workspace', url: expect.stringContaining('workspace.html') }));
		await expect.poll(() =>
			app.evaluate(({ BrowserWindow }) => {
				const win = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'Workspace');
				const view = win?.contentView.children[0] as WebContentsView | undefined;
				return win?.isVisible() && view?.webContents.getURL() === 'kucedr-app://workspace/dist/index.html';
			})
		).toBe(true);
		await expect.poll(() =>
			app.evaluate(async ({ BrowserWindow }) => {
				const win = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'Workspace');
				const view = win?.contentView.children[0] as WebContentsView | undefined;
				return view?.webContents.executeJavaScript('document.body.innerText.includes("Workspace")');
			})
		).toBe(true);
	} finally {
		await app.close();
		await rm(userDataDir, { recursive: true, force: true });
	}
});
