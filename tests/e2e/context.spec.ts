import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('context ring keeps custom limits unavailable and resolves catalog limits', async () => {
	const server = createServer((request, response) => {
		if (request.url === '/v1/models') {
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify({ data: [{ id: 'context-test' }] }));
		} else if (request.url === '/v1/chat/completions') {
			response.setHeader('content-type', 'text/event-stream');
			for (const chunk of [
				{ choices: [{ index: 0, delta: { role: 'assistant', content: 'Context tracking verified.' }, finish_reason: null }] },
				{ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 16000, completion_tokens: 384 } },
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
		const ring = page.getByRole('progressbar', { name: 'Context window used' });
		const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
		await editor.fill('Please say hello.');
		await editor.press('Enter');
		await expect(page.getByText('Context tracking verified.', { exact: true })).toBeVisible();
		await expect(ring).not.toHaveAttribute('aria-valuenow');
		await expect(ring).toHaveAttribute('aria-valuetext', 'Context window unavailable');
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await editor.focus();
		for (
			let index = 0;
			index < 12 &&
			!(await ring.locator('..').evaluate((element) => element === document.activeElement));
			index += 1
		)
			await page.keyboard.press('Tab');
		await expect(ring.locator('..')).toBeFocused();
		await expect(
			page.locator('[data-slot="tooltip-content"]').filter({ hasText: 'The provider has not reported a context limit for this model.' })
		).toBeVisible();
		await editor.fill('x'.repeat(3000));
		await expect(ring).toHaveAttribute('aria-valuetext', 'Context window unavailable');
		await editor.fill('');
		await page.reload();
		await expect(ring).not.toHaveAttribute('aria-valuenow');
		await expect(ring).toHaveAttribute('aria-valuetext', 'Context window unavailable');
		await page.getByRole('button', { name: 'Change model' }).click();
		await page.getByRole('menuitemradio', { name: /GPT-5.4 Mini/ }).click();
		await expect(ring).toHaveAttribute('aria-valuetext', /400[,.]000 tokens/);
		await expect(ring).toHaveAttribute('aria-valuetext', /^Estimated context/);
		await expect(ring).toHaveAttribute('aria-valuenow', '0');
		await editor.fill('x'.repeat(3000));
		await expect(ring).toHaveAttribute('aria-valuetext', /^Estimated context: 1[,.]0\d{2} \/ 400[,.]000 tokens/);
		await expect(page.getByText('This page crashed')).toHaveCount(0);
	} finally {
		await closeApp(app, userDataDir);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
