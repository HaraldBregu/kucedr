import { _electron as electron, expect, test } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('uploaded app settings survive restart and replacement and control new windows', async ({
	browserName: _browserName,
}, testInfo) => {
	test.setTimeout(90_000);
	const launched = await launchApp();
	let { app, page } = launched;
	const { userDataDir } = launched;
	try {
		const source = path.join(userDataDir, 'upload', 'window-demo');
		await mkdir(source, { recursive: true });
		const manifest = {
			title: 'Window Demo',
			description: 'Window configuration test app',
			metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
			window: { width: 900, height: 650, minWidth: 500, minHeight: 300 },
		};
		await writeFile(path.join(source, 'manifest.json'), JSON.stringify(manifest));
		await writeFile(path.join(source, 'index.html'), '<h1>Window demo</h1>');
		await app.evaluate(({ dialog }, folder) => {
			dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
		}, source);
		await page.evaluate(async () => {
			await window.agent.setProvider({
				id: 'openai',
				name: 'OpenAI',
				baseUrl: 'https://api.openai.com/v1',
			});
			await window.agent.setModelId('gpt-5.6-luna');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
			await window.apps.import();
		});
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(() => {
			window.location.hash = '#/settings/apps/window-demo';
		});
		await expect(page.getByRole('spinbutton', { name: 'Default width (px)' })).toHaveValue('900');
		await page.getByRole('spinbutton', { name: 'Default width (px)' }).fill('1000');
		await page.getByRole('spinbutton', { name: 'Default height (px)' }).fill('720');
		await page.getByRole('switch', { name: 'Allow resizing' }).click();
		await page.getByRole('switch', { name: 'Allow maximizing' }).click();
		await page.getByRole('button', { name: 'Save settings' }).click();
		await expect(page.getByRole('status')).toContainText('saved');
		const stored = JSON.parse(
			await readFile(path.join(userDataDir, 'apps/window-demo/manifest.json'), 'utf8')
		);
		expect(stored.window).toMatchObject({
			width: 1000,
			height: 720,
			resizable: false,
			maximizable: false,
		});
		await app.evaluate(({ BrowserWindow }) => {
			const win = BrowserWindow.getAllWindows()[0];
			win.setMinimumSize(390, 600);
			win.setSize(390, 800);
		});
		await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
		await page.getByRole('spinbutton', { name: 'Default width (px)' }).scrollIntoViewIfNeeded();
		await page.screenshot({ path: testInfo.outputPath('app-settings-narrow.png'), fullPage: true });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await app.evaluate(({ BrowserWindow }) => {
			BrowserWindow.getAllWindows()[0].setSize(1100, 850);
		});
		await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(1100);
		await page.screenshot({
			path: testInfo.outputPath('app-settings-desktop.png'),
			fullPage: true,
		});
		await page.getByRole('button', { name: 'Open', exact: true }).click();
		await expect
			.poll(() =>
				app.evaluate(({ BrowserWindow }) => {
					const win = BrowserWindow.getAllWindows().find(
						(item) => item.getTitle() === 'Window Demo'
					);
					return (
						win && {
							size: win.getSize(),
							minimum: win.getMinimumSize(),
							resizable: win.isResizable(),
							maximizable: win.isMaximizable(),
						}
					);
				})
			)
			.toEqual({ size: [1000, 720], minimum: [500, 300], resizable: false, maximizable: false });
		await app.close();
		app = await electron.launch({
			args: [`--user-data-dir=${userDataDir}`, path.resolve('.')],
			env: {
				...process.env,
				NODE_ENV: 'production',
				ELECTRON_RENDERER_URL: '',
				KUCEDR_E2E_DATA_ROOT: userDataDir,
			},
		});
		page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		expect(await page.evaluate(() => window.apps.getSettings('window-demo'))).toMatchObject({
			width: 1000,
			height: 720,
			resizable: false,
		});
		await writeFile(
			path.join(source, 'manifest.json'),
			JSON.stringify({ ...manifest, window: { width: 920, height: 680 } })
		);
		await app.evaluate(({ dialog }, folder) => {
			dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
		}, source);
		await page.evaluate(() => window.apps.import());
		expect(await page.evaluate(() => window.apps.getSettings('window-demo'))).toMatchObject({
			width: 920,
			height: 680,
			resizable: true,
		});
		await page.evaluate(() => {
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		});
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(() => {
			window.location.hash = '#/settings/apps/window-demo';
		});
		await page.getByRole('button', { name: 'Open', exact: true }).click();
		await expect
			.poll(() =>
				app.evaluate(({ BrowserWindow }) => {
					const win = BrowserWindow.getAllWindows().find(
						(item) => item.getTitle() === 'Window Demo'
					);
					return win?.getSize();
				})
			)
			.toEqual([920, 680]);
	} finally {
		await closeApp(app, userDataDir);
	}
});
