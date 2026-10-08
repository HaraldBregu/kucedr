import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('production Apps search and Bot navigation work in Electron', async ({
	browserName: _browserName,
}, testInfo) => {
	test.setTimeout(90_000);
	const { app, page, userDataDir } = await launchApp();
	try {
		await expect(page).toHaveURL(/#\/?start$/);
		const fixtures = [
			{
				id: 'orbit-notes',
				title: 'Orbit Notes',
				description: 'Capture ideas and quick checklists.',
			},
			{
				id: 'timer-desk',
				title: 'Focus Timer',
				description: 'Keep track of deep work sessions.',
			},
		];
		const sources: string[] = [];
		for (const fixture of fixtures) {
			const source = path.join(userDataDir, 'upload', fixture.id);
			await mkdir(source, { recursive: true });
			await writeFile(
				path.join(source, 'manifest.json'),
				JSON.stringify({
					title: fixture.title,
					description: fixture.description,
					metadata: { version: '1.0.0', category: 'utility', entry: 'index.html' },
				})
			);
			await writeFile(path.join(source, 'index.html'), `<h1>${fixture.title}</h1>`);
			sources.push(source);
		}
		await app.evaluate(({ dialog }, folders) => {
			dialog.showOpenDialog = async () => ({ canceled: false, filePaths: folders });
		}, sources);
		const imported = await page.evaluate(async () => {
			await window.agent.setProvider({
				id: 'openai',
				name: 'OpenAI',
				baseUrl: 'https://api.openai.com/v1',
			});
			await window.agent.setModelId('gpt-5.6-luna');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
			return window.apps.import();
		});
		expect(imported?.imported.map(({ id }) => id).sort()).toEqual(['orbit-notes', 'timer-desk']);
		expect(imported?.skipped).toEqual([]);
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await app.evaluate(({ BrowserWindow }) => {
			BrowserWindow.getAllWindows()[0].setSize(1100, 850);
		});
		await page.evaluate(() => {
			window.location.hash = '#/settings/apps';
		});
		const workspace = page.locator('[data-slot="settings-workspace"]');
		const notes = workspace.getByRole('link', { name: /Orbit Notes/ });
		const timer = workspace.getByRole('link', { name: /Focus Timer/ });
		const search = workspace.getByRole('searchbox', { name: 'Search apps' });
		await expect(notes).toBeVisible();
		await expect(timer).toBeVisible();
		await expect(search).toBeVisible();
		await expect(workspace.getByRole('heading', { name: 'Debug', exact: true })).toHaveCount(0);
		await expect(workspace.getByLabel('App folder path', { exact: true })).toHaveCount(0);
		await expect(workspace.getByRole('button', { name: 'Add Path', exact: true })).toHaveCount(0);
		await expect(workspace.getByRole('button', { name: 'Select Folder', exact: true })).toHaveCount(
			0
		);

		const sidebar = page.locator('[data-slot="settings-sidebar"]');
		const bot = sidebar.locator('[data-slot="split-pane-group"]').filter({
			has: page.getByRole('heading', { name: 'Bot', exact: true }),
		});
		const extensions = sidebar.locator('[data-slot="split-pane-group"]').filter({
			has: page.getByRole('heading', { name: 'Extensions', exact: true }),
		});
		await expect(bot.getByRole('link', { name: 'Channels', exact: true })).toBeVisible();
		await expect(bot.locator('a[href$="/settings/remote-agent"]')).toBeVisible();
		await expect(bot.getByRole('link')).toHaveCount(2);
		await expect(extensions.getByRole('link', { name: 'Apps', exact: true })).toBeVisible();
		await expect(extensions.getByRole('link', { name: 'Plugins', exact: true })).toBeVisible();
		await expect(extensions.getByRole('link')).toHaveCount(2);
		const headings = (
			await sidebar.locator('[data-slot="split-pane-group"] h2').allTextContents()
		).map((value) => value.trim());
		expect(headings.indexOf('Bot')).toBeLessThan(headings.indexOf('Extensions'));
		await extensions.getByRole('link', { name: 'Apps', exact: true }).scrollIntoViewIfNeeded();
		await page.screenshot({ path: testInfo.outputPath('apps-desktop.png'), fullPage: true });

		for (const query of ['  ORBIT NOTES  ', 'CHECKLISTS', 'ORBIT-NOTES']) {
			await search.fill(query);
			await expect(notes).toBeVisible();
			await expect(timer).toHaveCount(0);
		}
		await search.fill('TIMER-DESK');
		await expect(timer).toBeVisible();
		await expect(notes).toHaveCount(0);
		await search.fill('does-not-exist');
		await expect(workspace.getByText('No apps found', { exact: true })).toBeVisible();
		await expect(notes).toHaveCount(0);
		await expect(timer).toHaveCount(0);
		await workspace.getByRole('button', { name: 'Clear search', exact: true }).click();
		await expect(search).toHaveValue('');
		await expect(notes).toBeVisible();
		await expect(timer).toBeVisible();

		await app.evaluate(({ BrowserWindow }) => {
			const window = BrowserWindow.getAllWindows()[0];
			window.setMinimumSize(390, 600);
			window.setSize(390, 800);
		});
		await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(390);
		await expect(search).toBeVisible();
		await expect(notes).toBeVisible();
		await expect(timer).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
		await page.screenshot({ path: testInfo.outputPath('apps-narrow.png'), fullPage: true });
		await app.evaluate(({ BrowserWindow }) => {
			BrowserWindow.getAllWindows()[0].setSize(1100, 850);
		});
		await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(1100);
		await notes.getByRole('button', { name: 'Open', exact: true }).click();
		await expect
			.poll(() =>
				app.evaluate(({ BrowserWindow }) =>
					BrowserWindow.getAllWindows().map((window) => ({
						title: window.getTitle(),
						visible: window.isVisible(),
						url: window.webContents.getURL(),
					}))
				)
			)
			.toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Orbit Notes', visible: true })]));
		await app.evaluate(({ BrowserWindow }) => {
			BrowserWindow.getAllWindows()
				.find((window) => window.getTitle() === 'Orbit Notes')
				?.close();
		});
		await timer.click();
		await expect(page).toHaveURL(/#\/settings\/apps\/timer-desk$/);
		await expect(
			workspace.getByRole('heading', { name: 'Focus Timer', exact: true })
		).toBeVisible();
		await workspace.getByRole('button', { name: 'Open', exact: true }).click();
		await expect
			.poll(() =>
				app.evaluate(({ BrowserWindow }) =>
					BrowserWindow.getAllWindows().some(
						(window) => window.getTitle() === 'Focus Timer' && window.isVisible()
					)
				)
			)
			.toBe(true);
	} finally {
		await closeApp(app, userDataDir);
	}
});
