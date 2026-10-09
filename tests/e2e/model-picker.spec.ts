import { expect, test } from '@playwright/test';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('reopening a selected model keeps the search field fully visible', async ({}, testInfo) => {
	test.setTimeout(60_000);
	const { app, page, userDataDir } = await launchApp();
	try {
		await page.evaluate(async () => {
			await window.agent.setProvider({ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' });
			await window.agent.setModelId('gpt-5.6-luna');
			sessionStorage.setItem('kucedr-auth-local-only', 'true');
			sessionStorage.setItem('kucedr-onboarding-started', 'true');
		});
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(() => { location.hash = '#/settings/agent'; });
		const trigger = page.getByRole('button', { name: 'LLM Model', exact: true });
		await trigger.click();
		await page.getByRole('menuitemradio').last().click();
		for (const width of [1100, 390]) {
			await app.evaluate(({ BrowserWindow }, nextWidth) => {
				const win = BrowserWindow.getAllWindows()[0];
				win.setMinimumSize(390, 600);
				win.setSize(nextWidth, 750);
			}, width);
			await trigger.click();
			const dialog = page.getByRole('dialog');
			await expect.poll(() => dialog.getByRole('menu').evaluate((menu) => menu.scrollTop)).toBeGreaterThan(0);
			await page.screenshot({ path: testInfo.outputPath(`model-picker-${width}.png`) });
			await expect.poll(() => dialog.evaluate((content) => content.scrollTop)).toBe(0);
			expect(await dialog.evaluate((content) => {
				const input = content.querySelector('input')!;
				const menu = content.querySelector('[role="menu"]')!;
				const selected = menu.querySelector('[aria-checked="true"]')!;
				const bounds = content.getBoundingClientRect();
				const searchBounds = input.getBoundingClientRect();
				const menuBounds = menu.getBoundingClientRect();
				const selectedBounds = selected.getBoundingClientRect();
				return searchBounds.top >= bounds.top && searchBounds.bottom <= menuBounds.top && selectedBounds.top >= menuBounds.top - 1 && selectedBounds.bottom <= menuBounds.bottom + 1;
			})).toBe(true);
			await dialog.getByRole('textbox').press('Escape');
		}
	} finally {
		await closeApp(app, userDataDir);
	}
});
