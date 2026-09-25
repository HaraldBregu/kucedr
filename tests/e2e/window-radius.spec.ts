import { _electron as electron, expect, test } from '@playwright/test';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('window radius applies to open and new windows and persists', async () => {
	const testInfo = test.info();
	test.setTimeout(90_000);
	const launched = await launchApp();
	let { app, page } = launched;
	const { userDataDir } = launched;
	try {
		await page.evaluate(async () => {
			await window.agent.setProvider({
				id: 'openai',
				name: 'OpenAI',
				baseUrl: 'https://api.openai.com/v1',
			});
			await window.agent.setModelId('gpt-5.6-luna');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		});
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(() => {
			window.location.hash = '#/settings/general';
		});
		await expect(page).toHaveURL(/#\/settings\/general$/);
		const radius = page.getByRole('combobox', { name: 'Window corner radius' });
		await expect(radius).toContainText('20px');

		const secondOpened = app.waitForEvent('window');
		await app.evaluate(({ app, BrowserWindow }) => {
			const root = app.getAppPath();
			const second = new BrowserWindow({
				webPreferences: { preload: `${root}/out/preload/index.js` },
			});
			void second.loadFile(`${root}/out/renderer/app.html`);
		});
		const second = await secondOpened;
		await second.waitForLoadState('domcontentloaded');

		await radius.click();
		await page.getByRole('option', { name: '24px' }).click();
		for (const windowPage of [page, second]) {
			await expect.poll(() => windowPage.locator('.app-translucent-window').evaluate((element) =>
				getComputedStyle(element).borderRadius
			)).toBe('24px');
		}
		await expect(page.getByRole('combobox', { name: 'Window corner radius' })).toContainText('24px');
		await expect(page.evaluate(() => window.app.setWindowRadius(13 as 24))).rejects.toThrow();
		expect(await page.evaluate(() => window.app.getWindowRadius())).toBe(24);

		await page.screenshot({ path: testInfo.outputPath('radius-light.png') });
		await page.getByRole('button', { name: 'Dark theme' }).click();
		await expect(page.locator('html')).toHaveClass(/dark/);
		await expect.poll(() => page.locator('.app-translucent-window').evaluate((element) =>
			getComputedStyle(element).borderRadius
		)).toBe('24px');
		await expect.poll(() => second.locator('.app-translucent-window').evaluate((element) =>
			getComputedStyle(element).borderRadius
		)).toBe('24px');
		await page.screenshot({ path: testInfo.outputPath('radius-dark.png') });

		const thirdOpened = app.waitForEvent('window');
		await app.evaluate(({ app, BrowserWindow }) => {
			const root = app.getAppPath();
			const third = new BrowserWindow({
				webPreferences: { preload: `${root}/out/preload/index.js` },
			});
			void third.loadFile(`${root}/out/renderer/index.html`);
		});
		const third = await thirdOpened;
		await third.waitForLoadState('domcontentloaded');
		await expect.poll(() => third.locator('.app-translucent-window').evaluate((element) =>
			getComputedStyle(element).borderRadius
		)).toBe('24px');

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
		await expect.poll(() => page.evaluate(() => window.app.getWindowRadius())).toBe(24);
		await expect.poll(() => page.locator('.app-translucent-window').evaluate((element) =>
			getComputedStyle(element).borderRadius
		)).toBe('24px');
	} finally {
		await closeApp(app, userDataDir);
	}
});
