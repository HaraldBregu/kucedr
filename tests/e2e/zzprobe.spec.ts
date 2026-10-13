import { expect, test } from '@playwright/test';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('probe4', async () => {
	const { app, page, userDataDir } = await launchApp();
	try {
		await expect(page).toHaveURL(/#\/?start$/);
		await page.evaluate(async () => {
			await window.agent.setProvider({ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' });
			await window.agent.setModelId('gpt-5.6-luna');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		});
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(async () => {
			await window.agent.createWorkspaceDirectory('', 'Notes');
			await window.agent.createWorkspaceFile('Notes', 'plan.md');
			await window.agent.writeWorkspaceFile('Notes/plan.md', '# Plan');
		});
		await page.evaluate(() => { window.location.hash = '#/workspace'; });
		await page.waitForTimeout(1000);
		const nav = page.getByRole('navigation', { name: 'Workspace files' });
		await nav.getByText('Notes').click();
		await nav.getByRole('button', { name: 'plan.md' }).click();
		await page.waitForTimeout(1200);
		const modes = page.getByRole('group', { name: 'Markdown view' });
		for (const label of ['Raw', 'Text']) {
			console.log(label, JSON.stringify(await modes.getByRole('button', { name: label }).evaluate((b) => ({
				pressed: b.getAttribute('aria-pressed'),
				borderTopColor: getComputedStyle(b).borderTopColor,
				firstChildClass: b.firstElementChild?.className,
				firstChildBg: b.firstElementChild ? getComputedStyle(b.firstElementChild).backgroundColor : null,
				radii: [getComputedStyle(b).borderTopLeftRadius, getComputedStyle(b).borderTopRightRadius, getComputedStyle(b).borderBottomLeftRadius, getComputedStyle(b).borderBottomRightRadius],
			}))));
		}
		// composer shell padding on home
		await page.evaluate(() => { window.location.hash = '#/home'; });
		await page.waitForTimeout(800);
		console.log('composer shell', await page.locator('[data-slot="home-composer-shell"]').evaluate((el) => JSON.stringify({ cls: el.className, pb: getComputedStyle(el).paddingBottom, parentPb: el.parentElement ? getComputedStyle(el.parentElement).paddingBottom : null })));
		// database page
		await page.evaluate(() => { window.location.hash = '#/settings/providers/database'; });
		await page.waitForTimeout(1500);
		console.log('db h1', await page.locator('h1').allTextContents());
		console.log('db labels', await page.locator('[data-slot="settings-workspace"]').evaluate((el) => [...el.querySelectorAll('a,button,input,label')].map((n) => `${n.tagName} aria="${n.getAttribute('aria-label')}" href="${n.getAttribute('href')}" text="${n.textContent?.trim().slice(0,40)}"`).join('\n')));
	} finally {
		await closeApp(app, userDataDir);
	}
});
