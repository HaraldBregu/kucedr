import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('each reply retains its own run insights after reload', async () => {
	let turns = 0;
	const server = createServer((request, response) => {
		if (request.url === '/v1/models') {
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify({ data: [{ id: 'context-test' }] }));
		} else if (request.url === '/v1/chat/completions') {
			turns += 1;
			response.setHeader('content-type', 'text/event-stream');
			for (const chunk of [
				{ choices: [{ index: 0, delta: { role: 'assistant', content: 'Insights reply ' + turns }, finish_reason: null }] },
				{ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 16000, completion_tokens: 384 * turns } },
			]) response.write(`data: ${JSON.stringify(chunk)}\n\n`);
			response.end('data: [DONE]\n\n');
		} else {
			response.statusCode = 404;
			response.end('{}');
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Local test server unavailable');
	const { app, page, userDataDir } = await launchApp();
	try {
		await expect(page).toHaveURL(/#\/?start$/);
		await page.evaluate(async (baseUrl) => {
			await window.provider.set({ kind: 'models', id: 'custom', apiKey: 'local-test', baseUrl });
			await window.agent.setProvider({ id: 'custom', name: 'Custom model provider', baseUrl });
			await window.agent.setModelId('context-test');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		}, `http://127.0.0.1:${address.port}/v1`);
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
		const insights = page.getByRole('button', { name: 'Run insights' });
		const dialog = page.getByRole('dialog', { name: 'Run insights' });
		for (let turn = 1; turn <= 2; turn++) {
			await editor.fill('Reply to message ' + turn);
			await editor.press('Enter');
			await expect(page.getByText('Insights reply ' + turn, { exact: true })).toBeVisible();
			await insights.nth(turn - 1).click();
			await expect(dialog.getByText(String(turn * 384), { exact: true })).toBeVisible();
			await expect(dialog.getByText('Timeline', { exact: true })).toBeVisible();
			await page.keyboard.press('Escape');
		}
		await page.reload();
		for (let turn = 1; turn <= 2; turn++) {
			await insights.nth(turn - 1).click();
			await expect(dialog.getByText(String(turn * 384), { exact: true })).toBeVisible();
			await page.keyboard.press('Escape');
		}
	} finally {
		await closeApp(app, userDataDir);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
