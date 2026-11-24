import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('a new chat includes durable memory and recalls a matching summary on demand', async () => {
	const requests: string[] = [];
	const server = createServer(async (request, response) => {
		if (request.url === '/v1/models') {
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify({ data: [{ id: 'memory-test' }] }));
			return;
		}
		let body = '';
		for await (const chunk of request) body += chunk.toString();
		requests.push(body);
		response.setHeader('content-type', 'text/event-stream');
		const reply = 'Fixture reply ' + requests.length;
		response.write('data: ' + JSON.stringify({
			choices: [{ index: 0, delta: { role: 'assistant', content: reply }, finish_reason: null }],
		}) + '\n\n');
		response.write('data: ' + JSON.stringify({
			choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
		}) + '\n\n');
		response.end('data: [DONE]\n\n');
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Local test server unavailable');
	const { app, page, userDataDir } = await launchApp();
	try {
		const durable = 'Permanent fixture preference';
		const detail = 'archived greenhouse detail';
		const unrelated = 'unrelated archive detail';
		const directory = path.join(userDataDir, 'memory');
		await mkdir(directory, { recursive: true });
		await writeFile(path.join(directory, 'MEMORY.md'), [
			'## Preferences', '- ' + durable, '## Summaries',
			'- Heliotrope ' + detail, '- Aubergine ' + unrelated,
		].join('\n'));
		await expect(page).toHaveURL(/#\/?start$/);
		await page.evaluate(async (baseUrl) => {
			await window.provider.set({ kind: 'models', id: 'custom', apiKey: 'local-test', baseUrl });
			await window.agent.setProvider({ id: 'custom', name: 'Custom model provider', baseUrl });
			await window.agent.setModelId('memory-test');
			sessionStorage.setItem('kucedr-auth-local-only', 'true');
			sessionStorage.setItem('kucedr-onboarding-started', 'true');
		}, 'http://127.0.0.1:' + address.port + '/v1');
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
		await editor.fill('Say hello.');
		await editor.press('Enter');
		await expect(page.getByText('Fixture reply 1', { exact: true })).toBeVisible();
		expect(requests[0]).toContain(durable);
		expect(requests[0]).not.toContain(detail);
		expect(requests[0]).not.toContain(unrelated);
		await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
		await editor.fill('Tell me about heliotrope.');
		await editor.press('Enter');
		await expect(page.getByText('Fixture reply 2', { exact: true })).toBeVisible();
		expect(requests[1]).toContain(detail);
		expect(requests[1]).not.toContain(unrelated);
	} finally {
		await closeApp(app, userDataDir);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
