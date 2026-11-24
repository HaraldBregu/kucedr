import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('a token budget pauses before sending and lets the user stop or continue', async () => {
	let calls = 0;
	const server = createServer((request, response) => {
		if (request.url === '/v1/chat/completions') {
			calls++;
			response.setHeader('content-type', 'text/event-stream');
			response.write(
				'data: ' +
					JSON.stringify({
						choices: [
							{
								index: 0,
								delta: { role: 'assistant', content: 'Budget test reply.' },
								finish_reason: 'stop',
							},
						],
					}) +
					'\n\n'
			);
			response.end('data: [DONE]\n\n');
		} else {
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify({ data: [{ id: 'budget-test' }] }));
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
			await window.agent.setModelId('budget-test');
			sessionStorage.setItem('kucedr-auth-local-only', 'true');
			sessionStorage.setItem('kucedr-onboarding-started', 'true');
		}, `http://127.0.0.1:${address.port}/v1`);
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await page.evaluate(() => {
			location.hash = '#/settings/agent';
		});
		const tokens = page.getByRole('spinbutton', { name: 'Tokens per run' });
		await tokens.fill('1');
		await page.getByRole('button', { name: 'Save limits' }).click();
		await expect
			.poll(() => page.evaluate(() => window.agent.getRunBudget()))
			.toEqual({ tokens: 1 });
		await page.reload();
		await expect(tokens).toHaveValue('1');
		await page.evaluate(() => {
			location.hash = '#/home';
		});
		const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
		const pause = page.getByRole('group', { name: 'Run paused at budget limit' });
		for (const decision of ['Stop run', 'Continue for one model call']) {
			await editor.fill(`Test budget decision ${decision}`);
			await editor.press('Enter');
			await expect(pause).toBeVisible();
			expect(calls).toBe(0);
			await pause.getByRole('button', { name: decision }).click();
			await expect(pause).toHaveCount(0);
		}
		await expect(page.getByText('Budget test reply.', { exact: true })).toBeVisible();
		expect(calls).toBe(1);
	} finally {
		await closeApp(app, userDataDir);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
