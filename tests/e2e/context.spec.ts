import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('context ring follows real local usage, draft changes, model selection and restored history', async () => {
	const server = createServer((request, response) => {
		response.setHeader('content-type', 'application/json');
		if (request.url === '/api/tags')
			response.end(JSON.stringify({ models: [{ name: 'context-test' }] }));
		else if (request.url === '/api/ps')
			response.end(JSON.stringify({ models: [{ name: 'context-test', context_length: 32768 }] }));
		else if (request.url === '/api/show')
			response.end(JSON.stringify({ parameters: 'num_ctx 32768' }));
		else if (request.url === '/api/chat')
			response.end(
				JSON.stringify({
					message: { role: 'assistant', content: 'Context tracking verified.' },
					done: true,
					done_reason: 'stop',
					prompt_eval_count: 16000,
					eval_count: 384,
				}) + '\n'
			);
		else {
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
			await window.agent.setProvider({ id: 'ollama', name: 'Ollama', baseUrl });
			await window.agent.setModelId('context-test');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		}, `http://127.0.0.1:${address.port}/api`);
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		const ring = page.getByRole('progressbar', { name: 'Context window used' });
		await expect(ring).toHaveAttribute('aria-valuenow', '0');
		const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
		await editor.fill('Please say hello.');
		await editor.press('Enter');
		await expect(page.getByText('Context tracking verified.', { exact: true })).toBeVisible();
		await expect(ring).toHaveAttribute('aria-valuenow', '50');
		await expect(ring).toHaveAttribute(
			'aria-valuetext',
			/^Context: 16[,.]384 \/ 32[,.]768 tokens \(50% used\)$/
		);
		await ring.locator('..').hover();
		await expect(page.locator('[data-slot="tooltip-content"]')).toContainText(
			/16[,.]384 \/ 32[,.]768/
		);
		await editor.focus();
		for (
			let index = 0;
			index < 12 &&
			!(await ring.locator('..').evaluate((element) => element === document.activeElement));
			index += 1
		)
			await page.keyboard.press('Tab');
		await expect(ring.locator('..')).toBeFocused();
		await expect(page.locator('[data-slot="tooltip-content"]')).toBeVisible();
		await page.screenshot({ path: '/private/tmp/kucedr-context-ring.png' });
		await editor.fill('x'.repeat(3000));
		await expect(ring).toHaveAttribute('aria-valuenow', '53');
		await editor.fill('');
		await page.reload();
		await expect(ring).toHaveAttribute('aria-valuenow', '50');
		await page.getByRole('button', { name: 'Change model' }).click();
		await page.getByRole('menuitemradio', { name: /GPT-5.4 Mini/ }).click();
		await expect(ring).toHaveAttribute('aria-valuetext', /400[,.]000 tokens/);
		await expect(ring).toHaveAttribute('aria-valuetext', /^Estimated context/);
		await expect(page.getByText('This page crashed')).toHaveCount(0);
	} finally {
		await closeApp(app, userDataDir);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
