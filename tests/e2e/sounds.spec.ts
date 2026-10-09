import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { launchApp } from './helpers';
import { closeApp } from './close';

declare global {
	interface Window {
		feedbackPlayback: { source: string; volume: number; ended: boolean; error?: string }[];
	}
}

test('bundled feedback plays for chat and navigation and stays muted after reload', async ({
	browserName: _browserName,
}, testInfo) => {
	test.setTimeout(90_000);
	const { app, page, userDataDir } = await launchApp();
	try {
		await page.addInitScript(() => {
			const records: { source: string; volume: number; ended: boolean; error?: string }[] = [];
			Object.assign(window, { feedbackPlayback: records });
			const play = HTMLMediaElement.prototype.play;
			HTMLMediaElement.prototype.play = function () {
				const record = {
					source: this.src,
					volume: this.volume,
					ended: false,
					error: undefined as string | undefined,
				};
				records.push(record);
				this.addEventListener(
					'ended',
					() => {
						record.ended = true;
					},
					{ once: true }
				);
				return play.call(this).catch((error: Error) => {
					record.error = error.message;
					throw error;
				});
			};
		});
		await page.evaluate(async () => {
			await window.agent.setProvider({
				id: 'openai',
				name: 'OpenAI',
				baseUrl: 'https://api.openai.com/v1',
			});
			await window.agent.setModelId('gpt-5.6-luna');
			await window.app.setLanguage('en');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
		});
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await expect.poll(() => page.evaluate(() => window.app.getSoundFeedbackEnabled())).toBe(true);
		expect(await app.evaluate(({ Menu }) => {
			const item = Menu.getApplicationMenu()?.getMenuItemById('sound-feedback');
			return item && { label: item.label, type: item.type, checked: item.checked };
		})).toEqual({ label: 'Sound feedback', type: 'checkbox', checked: true });
		await app.evaluate(({ ipcMain }) => {
			ipcMain.removeHandler('agent:send');
			ipcMain.handle('agent:send', async (event, _message, options) => {
				const identity = { agentId: 'main', runId: options.runId };
				await new Promise((resolve) => setTimeout(resolve, 150));
				event.sender.send('agent:response', {
					...identity,
					type: 'run_started',
					sessionId: options.sessionId,
					interactionMode: 'default',
				});
				await new Promise((resolve) => setTimeout(resolve, 400));
				event.sender.send('agent:response', {
					...identity,
					type: 'text_delta',
					delta: 'Sound check complete.',
				});
				const finished = {
					...identity,
					type: 'run_finished',
					stopReason: 'end_turn',
					outputChars: 21,
				};
				event.sender.send('agent:response', finished);
				return { success: true, data: { text: 'Sound check complete.', finished } };
			});
		});
		await page.getByRole('button', { name: 'New Chat', exact: true }).click();
		await expect
			.poll(() =>
				page.evaluate(() => window.feedbackPlayback.filter((record) => record.ended).length)
			)
			.toBe(1);
		await page
			.getByRole('textbox', { name: 'Message your assistant' })
			.fill('Check the feedback sounds');
		await page.getByRole('textbox', { name: 'Message your assistant' }).press('Enter');
		await expect(page.getByText('Sound check complete.', { exact: true })).toBeVisible();
		await expect
			.poll(() =>
				page.evaluate(() => window.feedbackPlayback.filter((record) => record.ended).length)
			)
			.toBe(4);
		await page
			.locator('[data-slot="home-sidebar"] nav')
			.getByRole('button', { name: 'Settings', exact: true })
			.click();
		await expect(page.getByRole('switch', { name: 'Sound feedback' })).toBeChecked();
		await expect
			.poll(() =>
				page.evaluate(() => window.feedbackPlayback.filter((record) => record.ended).length)
			)
			.toBe(5);
		await page.getByRole('button', { name: /^Theme:/ }).click();
		await expect
			.poll(() =>
				page.evaluate(() => window.feedbackPlayback.filter((record) => record.ended).length)
			)
			.toBe(6);
		await page.getByRole('button', { name: 'Search', exact: true }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect
			.poll(() =>
				page.evaluate(() => window.feedbackPlayback.filter((record) => record.ended).length)
			)
			.toBe(7);
		const playback = await page.evaluate(() => window.feedbackPlayback);
		await testInfo.attach('native-audio-playback', {
			body: JSON.stringify(playback, null, 2),
			contentType: 'application/json',
		});
		expect(playback.map((record) => path.basename(record.source).split('-')[0])).toEqual([
			'click_001',
			'pluck_001',
			'question_003',
			'confirmation_001',
			'click_001',
			'toggle_004',
			'click_001',
		]);
		expect(playback.every((record) => !record.error && record.volume <= 0.3)).toBe(true);
		await page.getByRole('switch', { name: 'Sound feedback' }).click();
		await expect(page.getByRole('switch', { name: 'Sound feedback' })).not.toBeChecked();
		await expect.poll(() => page.evaluate(() => window.app.getSoundFeedbackEnabled())).toBe(false);
		expect(await app.evaluate(({ Menu }) =>
			Menu.getApplicationMenu()?.getMenuItemById('sound-feedback')?.checked
		)).toBe(false);
		for (const enabled of [true, false]) {
			await app.evaluate(({ Menu }) => {
				const item = Menu.getApplicationMenu()?.getMenuItemById('sound-feedback');
				if (!item) throw new Error('Sound feedback menu item is missing');
				item.click(item, undefined, {});
			});
			await expect(page.getByRole('switch', { name: 'Sound feedback' })).toHaveAttribute('aria-checked', String(enabled));
			expect(await page.evaluate(() => window.app.getSoundFeedbackEnabled())).toBe(enabled);
			expect(await app.evaluate(({ Menu }) =>
				Menu.getApplicationMenu()?.getMenuItemById('sound-feedback')?.checked
			)).toBe(enabled);
		}
		const settings = JSON.parse(
			await readFile(path.join(userDataDir, 'settings/app.json'), 'utf8')
		);
		expect(settings.soundFeedbackEnabled).toBe(false);
		await page.getByRole('button', { name: /^Theme:/ }).click();
		expect(await page.evaluate(() => window.feedbackPlayback.length)).toBe(7);
		await page.reload();
		await expect(page.getByRole('switch', { name: 'Sound feedback' })).not.toBeChecked();
		await page.getByRole('button', { name: /^Theme:/ }).click();
		expect(await page.evaluate(() => window.feedbackPlayback.length)).toBe(0);
		await page.getByRole('switch', { name: 'Sound feedback' }).click();
		await expect
			.poll(() =>
				page.evaluate(() => window.feedbackPlayback.filter((record) => record.ended).length)
			)
			.toBe(1);
		await page.screenshot({
			path: testInfo.outputPath('sound-feedback-settings.png'),
			fullPage: true,
		});
	} catch (error) {
		console.log('Audio playback:', await page.evaluate(() => window.feedbackPlayback));
		await page.screenshot({ path: testInfo.outputPath('failure.png'), fullPage: true });
		await testInfo.attach('renderer-state', {
			body: await page.locator('body').innerText(),
			contentType: 'text/plain',
		});
		throw error;
	} finally {
		await closeApp(app, userDataDir);
	}
});
