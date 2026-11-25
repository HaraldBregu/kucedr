import { expect, test } from '@playwright/test';
import { spawn } from 'node:child_process';
import { launchApp } from './helpers';
import { closeApp } from './close';

const details = (id: string): RegExp => new RegExp(`#/?settings/plugins/(marketplace/)?${id}$`);

test('plugin links open plugin details on cold and warm launch without installing', async () => {
	test.setTimeout(90_000);
	const { app, page, userDataDir } = await launchApp(['kucedr://plugins/cartesia']);
	try {
		await expect(page).toHaveURL(/#\/?start$/);
		await page.evaluate(async () => {
			await window.agent.setProvider({
				id: 'openai',
				name: 'OpenAI',
				baseUrl: 'https://api.openai.com/v1',
			});
			await window.agent.setModelId('gpt-5.6-luna');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		});
		await page.reload();
		await expect(page).toHaveURL(details('cartesia'));
		const installedIds = (): Promise<string[]> =>
			page.evaluate(async () => (await window.plugins.list()).map((plugin) => plugin.id));
		const before = await installedIds();

		const [executable, argv] = await app.evaluate(
			() => [process.execPath, process.argv.slice(1)] as const
		);
		const second = spawn(
			executable,
			[
				...(process.platform === 'linux' ? ['--no-sandbox'] : []),
				...argv.filter(
					(arg) => !/^--(inspect|remote-debugging-port|no-sandbox)|^kucedr:/.test(arg)
				),
				'kucedr://plugins/cohere',
			],
			{
				env: {
					...process.env,
					NODE_ENV: 'production',
					ELECTRON_RENDERER_URL: '',
					KUCEDR_E2E_DATA_ROOT: userDataDir,
				},
				stdio: ['ignore', 'ignore', 'pipe'],
			}
		);
		let output = '';
		second.stderr?.on('data', (chunk) => (output += chunk));
		const code = await new Promise((resolve) => second.once('exit', resolve));
		expect(code, output).toBe(0);
		await expect(page).toHaveURL(details('cohere'));

		const openUrl = (url: string): Promise<void> =>
			app.evaluate(({ app: electronApp }, link) => {
				electronApp.emit('open-url', { preventDefault: () => undefined }, link);
			}, url);
		await openUrl('kucedr://plugins/ideogram');
		await expect(page).toHaveURL(details('ideogram'));

		await openUrl('kucedr://plugins/Not_Valid');
		await openUrl('kucedr://plugins/ideogram/extra');
		await page.waitForTimeout(1_000);
		await expect(page).toHaveURL(details('ideogram'));

		await openUrl('kucedr://plugins/no-such-plugin');
		await expect(page).toHaveURL(details('no-such-plugin'));

		expect(await installedIds()).toEqual(before);
		expect(before.filter((id) => ['cartesia', 'cohere', 'ideogram'].includes(id))).toEqual([]);
	} finally {
		await closeApp(app, userDataDir);
	}
});
