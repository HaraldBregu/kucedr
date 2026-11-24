import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { launchApp } from './helpers';
import { closeApp } from './close';

test('automatic compaction preserves history and sends the summary to the model', async () => {
	const original = 'Original history search phrase';
	const summary = 'Summary of the earlier discussion.';
	const requests: string[] = [];
	const server = createServer(async (request, response) => {
		let body = '';
		for await (const chunk of request) body += chunk.toString();
		requests.push(body);
		const payload = JSON.parse(body) as { stream: boolean };
		if (!payload.stream) {
			response.setHeader('content-type', 'application/json');
			response.end(JSON.stringify({
				choices: [{ message: { content: summary }, finish_reason: 'stop' }],
			}));
			return;
		}
		response.setHeader('content-type', 'text/event-stream');
		response.end('data: ' + JSON.stringify({
			choices: [{ delta: { content: 'Compacted chat reply.' }, index: 0, finish_reason: 'stop' }],
		}) + '\n\ndata: [DONE]\n\n');
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const address = server.address();
	if (!address || typeof address === 'string') throw new Error('Local test server unavailable');

	const { app, page, userDataDir } = await launchApp();
	try {
		const baseUrl = `http://127.0.0.1:${address.port}/v1`;
		const plugin = path.join(userDataDir, 'plugins', 'compact-fixture');
		const model = path.join(plugin, 'models', 'fixture');
		await mkdir(model, { recursive: true });
		await writeFile(path.join(plugin, 'manifest.json'), JSON.stringify({
			schemaVersion: 5, id: 'compact-fixture', title: 'Compaction fixture',
			version: '1.0.0', description: 'Test model', author: 'Test', authentication: 'api-key',
		}));
		await writeFile(path.join(model, 'manifest.json'), JSON.stringify({
			id: 'fixture', name: 'Fixture', type: 'large-language-model',
			authentication: 'api-key', location: 'local', url: baseUrl, baseUrl,
			metadata: { protocol: 'chat-completions', contextWindow: 48_000, defaultOutputTokens: 1024, promptAttachments: [] },
		}));

		const sessionId = randomUUID();
		const session = path.join(userDataDir, 'sessions', sessionId);
		await mkdir(session, { recursive: true });
		await writeFile(path.join(session, 'messages.json'), JSON.stringify([
			{ role: 'user', content: original },
			{ role: 'assistant', content: 'The first reply.' },
			...Array.from({ length: 10 }, (_, index) => [
				{ role: 'user', content: `Earlier topic ${index}\n` + 'Details from the discussion. '.repeat(450) },
				{ role: 'assistant', content: `Earlier answer ${index}.` },
			]).flat(),
		]));
		await expect(page).toHaveURL(/#\/?start$/);
		await page.evaluate(async (id) => {
			await window.plugins.setEnabled('compact-fixture', true);
			await window.provider.set({ kind: 'models', id: 'compact-fixture', apiKey: 'fixture-key' });
			await window.agent.setProvider({ id: 'compact-fixture', name: 'Compaction fixture', baseUrl: '' });
			await window.agent.setModelId('fixture');
			await window.agent.setCompactModel({ providerId: 'compact-fixture', modelId: 'fixture', options: {} });
			localStorage.setItem('chat-session-id', id);
			sessionStorage.setItem('kucedr-auth-local-only', 'true');
			sessionStorage.setItem('kucedr-onboarding-started', 'true');
		}, sessionId);
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await expect(page.locator('[data-chat-turn]').getByText(original, { exact: true })).toBeVisible();
		const editor = page.locator('[data-slot="home-composer-shell"] [role="textbox"]');
		await editor.fill('Continue the discussion.');
		await editor.press('Enter');
		await expect(page.getByText('Compacted chat reply.', { exact: true })).toBeVisible();
		const marker = page.getByText('Earlier messages automatically summarized', { exact: true });
		await expect(marker).toBeVisible();
		await marker.click();
		await expect(page.getByText(summary, { exact: true })).toBeVisible();
		expect(requests.at(-1)).toContain(summary);
		expect(requests.at(-1)).toContain('Continue the discussion.');
		expect(requests.at(-1)).not.toContain(original);
		await page.reload();
		await expect(marker).toBeVisible();
		await expect(page.locator('[data-chat-turn]').getByText(original, { exact: true })).toBeVisible();
		expect(await page.evaluate((query) => window.agent.searchSessions(query), original))
			.toEqual(expect.arrayContaining([expect.objectContaining({ id: sessionId })]));
		const calls = requests.length;
		await editor.fill('Follow up after reload.');
		await editor.press('Enter');
		await expect(page.getByText('Compacted chat reply.', { exact: true })).toHaveCount(2);
		expect(requests).toHaveLength(calls + 1);
		expect(requests.at(-1)).toContain(summary);
		expect(requests.at(-1)).not.toContain(original);
	} finally {
		await closeApp(app, userDataDir);
		await new Promise<void>((resolve) => server.close(() => resolve()));
	}
});
