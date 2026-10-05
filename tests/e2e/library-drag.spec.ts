import { expect, test } from '@playwright/test';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('moves library files and folders by dropping them onto folders', async ({}, testInfo) => {
	test.setTimeout(90_000);
	const { app, page, userDataDir } = await launchApp();
	try {
		const libraryRoot = path.join(userDataDir, 'library');
		await mkdir(path.join(libraryRoot, 'Projects'), { recursive: true });
		await mkdir(path.join(libraryRoot, 'Archive'));
		await writeFile(path.join(libraryRoot, 'notes.txt'), 'notes');
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
		await page.evaluate(() => { window.location.hash = '#/settings/library'; });
		await expect(page.getByRole('table')).toBeVisible();
		await page.getByRole('row').filter({ hasText: 'notes.txt' }).dragTo(
			page.getByRole('row').filter({ hasText: 'Projects' })
		);
		await expect.poll(async () => readFile(path.join(libraryRoot, 'Projects', 'notes.txt'), 'utf8')).toBe('notes');
		await page.getByRole('button', { name: 'Collections' }).click();
		await page.locator('article').filter({ hasText: 'Projects' }).dragTo(
			page.locator('article').filter({ hasText: 'Archive' })
		);
		await expect.poll(async () => {
			try {
				await access(path.join(libraryRoot, 'Archive', 'Projects', 'notes.txt'));
				return true;
			} catch {
				return false;
			}
		}).toBe(true);
		await page.screenshot({ path: testInfo.outputPath('library-folders.png'), fullPage: true });
	} finally {
		await closeApp(app, userDataDir);
	}
});
