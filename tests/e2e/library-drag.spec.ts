import { expect, test } from '@playwright/test';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('moves library items and uploads files dropped from the desktop', async () => {
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
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(() => {
			window.location.hash = '#/settings/library';
		});
		await expect(page.getByRole('table')).toBeVisible();
		await page
			.getByRole('row')
			.filter({ hasText: 'notes.txt' })
			.dragTo(page.getByRole('row').filter({ hasText: 'Projects' }));
		await expect
			.poll(async () => readFile(path.join(libraryRoot, 'Projects', 'notes.txt'), 'utf8'))
			.toBe('notes');
		await expect(page.getByRole('row').filter({ hasText: 'notes.txt' })).toHaveCount(0);
		await page
			.getByRole('row')
			.filter({ hasText: 'Projects' })
			.getByRole('button', { name: 'Open Projects' })
			.click();
		await expect(page.getByRole('row').filter({ hasText: 'notes.txt' })).toBeVisible();
		await page
			.getByRole('navigation', { name: 'Library folders' })
			.getByRole('button', { name: 'Library' })
			.click();
		await page.getByRole('button', { name: 'Collections' }).click();
		await page
			.getByRole('article', { name: 'Projects' })
			.dragTo(page.getByRole('article', { name: 'Archive' }));
		await expect
			.poll(async () => {
				try {
					await access(path.join(libraryRoot, 'Archive', 'Projects', 'notes.txt'));
					return true;
				} catch {
					return false;
				}
			})
			.toBe(true);
		await expect(page.getByRole('article', { name: 'Projects' })).toHaveCount(0);
		await page.getByRole('button', { name: 'Open Archive' }).first().click();
		await page.getByRole('button', { name: 'Open Projects' }).first().click();
		await expect(page.getByText('notes.txt', { exact: true }).first()).toBeVisible();
		await page
			.getByRole('article', { name: 'notes.txt' })
			.dragTo(
				page
					.getByRole('navigation', { name: 'Library folders' })
					.getByRole('button', { name: 'Archive' })
			);
		await expect
			.poll(async () => readFile(path.join(libraryRoot, 'Archive', 'notes.txt'), 'utf8'))
			.toBe('notes');
		await expect(page.getByRole('article', { name: 'notes.txt' })).toHaveCount(0);
		await page
			.getByRole('navigation', { name: 'Library folders' })
			.getByRole('button', { name: 'Archive' })
			.click();
		await page.getByRole('button', { name: 'List' }).click();
		await page.getByRole('row').filter({ hasText: 'notes.txt' }).getByRole('checkbox').click();
		await page.getByRole('button', { name: 'More actions' }).click();
		await page.getByRole('menuitem', { name: 'Move to parent folder' }).click();
		await expect
			.poll(async () => readFile(path.join(libraryRoot, 'notes.txt'), 'utf8'))
			.toBe('notes');
		await expect(page.getByRole('row').filter({ hasText: 'notes.txt' })).toHaveCount(0);
		await page
			.getByRole('navigation', { name: 'Library folders' })
			.getByRole('button', { name: 'Library' })
			.click();
		await expect(page.getByRole('row').filter({ hasText: 'notes.txt' })).toBeVisible();
		await page.getByRole('row').filter({ hasText: 'Archive' }).getByRole('button').click();
		const source = path.join(userDataDir, 'draft.md');
		await writeFile(source, 'draft');
		const dropZone = page.getByRole('region', { name: 'Library upload drop zone' });
		const bounds = await dropZone.boundingBox();
		expect(bounds).not.toBeNull();
		const x = bounds!.x + bounds!.width / 2;
		const y = bounds!.y + bounds!.height / 2;
		const data = { items: [], files: [source], dragOperationsMask: 1 };
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
		await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
		await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
		await expect
			.poll(async () => readFile(path.join(libraryRoot, 'Archive', 'draft.md'), 'utf8'))
			.toBe('draft');
		await expect(page.getByRole('row').filter({ hasText: 'draft.md' })).toBeVisible();
		await page.screenshot({ path: test.info().outputPath('library-folders.png'), fullPage: true });
	} finally {
		await closeApp(app, userDataDir);
	}
});
