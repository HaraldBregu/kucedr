import { expect, test } from '@playwright/test';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('probe5', async () => {
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
		console.log('enabled before', JSON.stringify(await page.evaluate(() => window.provider.listEnabledPlugins())));
		console.log('set result', JSON.stringify(await page.evaluate(() => window.provider.setPluginEnabled('database', 'pinecone/pinecone', true)).catch((e) => 'ERR ' + e.message)));
		await page.evaluate(() => { window.location.hash = '#/settings/providers/database'; });
		await page.waitForTimeout(2000);
		console.log('db workspace', await page.locator('[data-slot="settings-workspace"]').evaluate((el) => [...el.querySelectorAll('a,button,input,label,h2,h3')].map((n) => `${n.tagName} aria="${n.getAttribute('aria-label')}" text="${n.textContent?.trim().slice(0,50)}"`).join('\n')));
	} finally {
		await closeApp(app, userDataDir);
	}
});

test('probe6', async () => {
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
		await page.evaluate(() => window.provider.setPluginEnabled('database', 'pinecone/pinecone', true));
		await page.evaluate(() => { window.location.hash = '#/settings/providers/database'; });
		await page.waitForTimeout(1500);
		await page.getByRole('button', { name: 'Connect' }).click();
		await page.waitForTimeout(800);
		console.log('after Connect', await page.locator('[data-slot="settings-workspace"]').evaluate((el) => [...el.querySelectorAll('a,button,input,label,h2,h3')].map((n) => `${n.tagName} aria="${n.getAttribute('aria-label')}" id="${n.id}" for="${n.getAttribute('for')}" text="${n.textContent?.trim().slice(0,50)}"`).join('\n')));
	} finally {
		await closeApp(app, userDataDir);
	}
});
