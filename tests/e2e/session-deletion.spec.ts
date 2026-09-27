import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('deleting a session removes its folder from the active data root', async () => {
	const { app, page, userDataDir } = await launchApp();
	const deletedId = '11111111-1111-4111-8111-111111111111';
	const keptId = '22222222-2222-4222-8222-222222222222';
	try {
		for (const id of [deletedId, keptId]) {
			const folder = path.join(userDataDir, 'sessions', id);
			mkdirSync(folder, { recursive: true });
			writeFileSync(path.join(folder, 'info.json'), JSON.stringify({ type: 'main' }));
			writeFileSync(path.join(folder, 'messages.json'), '[]\n');
		}
		const listedIds = await page.evaluate(() => window.agent.listSessions());
		expect(listedIds.map((session) => session.id)).toEqual(expect.arrayContaining([deletedId, keptId]));
		await page.evaluate((id) => window.agent.deleteSession(id), deletedId);
		expect(existsSync(path.join(userDataDir, 'sessions', deletedId))).toBe(false);
		expect(existsSync(path.join(userDataDir, 'sessions', keptId))).toBe(true);
	} finally {
		await closeApp(app, userDataDir);
	}
});
