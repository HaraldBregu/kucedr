import { expect, test } from '@playwright/test';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('probe7', async () => {
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
		await page.getByRole('button', { name: 'Connect', exact: true }).click();
		await page.getByLabel('Pinecone API key', { exact: true }).fill('database-test-key');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.waitForTimeout(1500);
		const dump = async (tag) => console.log(tag, await page.locator('[data-slot="settings-workspace"]').evaluate((el) => [...el.querySelectorAll('a,button,input,label,h2,h3,p,span')].filter((n)=>n.children.length===0||n.tagName==='BUTTON'||n.tagName==='INPUT').map((n) => `${n.tagName} aria="${n.getAttribute('aria-label')}" text="${n.textContent?.trim().slice(0,50)}"`).join('\n')));
		await dump('after Save');
		console.log('stored', JSON.stringify(await page.evaluate(() => window.provider.get('pinecone', 'databases'))));
		await page.reload();
		await page.waitForTimeout(2000);
		await dump('after reload');
	} finally {
		await closeApp(app, userDataDir);
	}
});

test('probe8', async () => {
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
		await page.getByRole('button', { name: 'Connect', exact: true }).click();
		await page.getByLabel('Pinecone API key', { exact: true }).fill('database-test-key');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await page.waitForTimeout(1000);
		await page.getByRole('button', { name: 'Options for Pinecone' }).click();
		await page.waitForTimeout(500);
		console.log('menu', await page.getByRole('menu').evaluate((el) => [...el.querySelectorAll('[role]')].map((n) => `${n.getAttribute('role')} text="${n.textContent?.trim().slice(0,40)}"`).join('\n')));
	} finally {
		await closeApp(app, userDataDir);
	}
});
