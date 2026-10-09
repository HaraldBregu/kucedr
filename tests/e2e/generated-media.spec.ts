import { expect, test } from '@playwright/test';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { closeApp } from './close';
import { launchApp } from './helpers';

test('restored chat displays library media and custom destinations with working playback', async () => {
	test.setTimeout(90_000);
	const { app, page, userDataDir } = await launchApp();
	try {
		const library = path.join(userDataDir, 'library');
		const custom = path.join(userDataDir, 'Chosen #à');
		await mkdir(library, { recursive: true });
		await mkdir(custom);
		const libraryImage = path.join(library, 'image #à.png');
		const customImage = path.join(custom, 'image custom.png');
		await copyFile(path.resolve('resources/icons/png/64x64.png'), libraryImage);
		await copyFile(path.resolve('resources/icons/png/128x128.png'), customImage);
		const screenshot = path.join(library, 'browser screenshot.png');
		await page.screenshot({ path: screenshot });
		const videoBytes = await page.evaluate(async () => {
			const canvas = document.createElement('canvas');
			canvas.width = 64;
			canvas.height = 48;
			const context = canvas.getContext('2d')!;
			const stream = canvas.captureStream(10);
			const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
			const chunks: Blob[] = [];
			recorder.ondataavailable = ({ data }) => chunks.push(data);
			const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });
			let frame = 0;
			const timer = setInterval(() => {
				context.fillStyle = frame++ % 2 === 0 ? '#60a5fa' : '#f59e0b';
				context.fillRect(0, 0, canvas.width, canvas.height);
			}, 100);
			recorder.start();
			await new Promise((resolve) => setTimeout(resolve, 1600));
			recorder.stop();
			await stopped;
			clearInterval(timer);
			stream.getTracks().forEach((track) => track.stop());
			return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
		});
		const audio = Buffer.alloc(44 + 16000 * 2);
		audio.write('RIFF', 0);
		audio.writeUInt32LE(audio.length - 8, 4);
		audio.write('WAVEfmt ', 8);
		audio.writeUInt32LE(16, 16);
		audio.writeUInt16LE(1, 20);
		audio.writeUInt16LE(1, 22);
		audio.writeUInt32LE(16000, 24);
		audio.writeUInt32LE(32000, 28);
		audio.writeUInt16LE(2, 32);
		audio.writeUInt16LE(16, 34);
		audio.write('data', 36);
		audio.writeUInt32LE(audio.length - 44, 40);
		for (let sample = 0; sample < 16000; sample += 1) {
			audio.writeInt16LE(Math.round(Math.sin(sample / 16000 * Math.PI * 2 * 440) * 2000), 44 + sample * 2);
		}
		const fixtures = [
			{ name: 'create_image', path: libraryImage, mimeType: 'image/png' },
			{ name: 'create_image', path: customImage, mimeType: 'image/png' },
			{ name: 'use_web_browser', path: screenshot, args: { action: 'screenshot' } },
			{ name: 'create_video', path: path.join(library, 'video #à.webm'), mimeType: 'video/webm' },
			{ name: 'create_video', path: path.join(custom, 'video custom.webm'), mimeType: 'video/webm' },
			{ name: 'create_sound', path: path.join(library, 'sound #à.wav'), mimeType: 'audio/wav' },
			{ name: 'create_sound', path: path.join(custom, 'sound custom.wav'), mimeType: 'audio/wav' },
			{ name: 'microphone_recorder_status', path: path.join(library, 'microphone #à.webm'), mimeType: 'audio/webm', status: 'completed' },
			{ name: 'camera_recorder_status', path: path.join(library, 'camera #à.webm'), mimeType: 'video/webm', status: 'completed' },
			{ name: 'screen_recorder_stop', path: path.join(custom, 'screen custom.webm'), mimeType: 'video/webm', status: 'completed' },
		];
		for (const fixture of fixtures) {
			if (fixture.name === 'create_sound' || fixture.name.startsWith('microphone')) {
				await writeFile(fixture.path, audio);
			} else if (fixture.mimeType === 'video/webm') {
				await writeFile(fixture.path, Buffer.from(videoBytes));
			}
		}
		const sessionId = '33333333-3333-4333-8333-333333333333';
		const session = path.join(userDataDir, 'sessions', sessionId);
		await mkdir(session, { recursive: true });
		await writeFile(path.join(session, 'info.json'), JSON.stringify({ type: 'main', title: 'Generated media' }));
		await writeFile(path.join(session, 'messages.json'), JSON.stringify([
			{ role: 'user', content: 'Show the generated media.' },
			{
				role: 'assistant', content: 'Generated media is ready.',
				toolCalls: fixtures.map((fixture, index) => ({
					id: `media-${index}`, name: fixture.name, args: fixture.args ?? {},
					result: { content: JSON.stringify({ path: fixture.path, mimeType: fixture.mimeType, status: fixture.status }) },
				})),
			},
		]));
		await page.evaluate(async (id) => {
			await window.agent.setProvider({ id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' });
			await window.agent.setModelId('gpt-5.6-luna');
			window.sessionStorage.setItem('kucedr-auth-local-only', 'true');
			window.sessionStorage.setItem('kucedr-onboarding-started', 'true');
			window.localStorage.setItem('chat-session-id', id);
		}, sessionId);
		await page.reload();
		await expect(page).toHaveURL(/#\/home$/);
		await expect(page.getByText('Generated media is ready.', { exact: true })).toBeVisible();
		const firstImage = page.getByRole('img', { name: 'Generated image 1 of 3' });
		await expect.poll(() => firstImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(64);
		await expect(firstImage).toHaveAttribute('src', /local-resource:\/\/file\/.*\/library\/image%20%23%C3%A0.png$/);
		await page.getByRole('button', { name: 'Show generated image 2 of 3' }).click();
		await expect.poll(() => page.getByRole('img', { name: 'Generated image 2 of 3' })
			.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(128);
		await page.getByRole('button', { name: 'Show generated image 3 of 3' }).click();
		await expect.poll(() => page.getByRole('img', { name: 'Generated image 3 of 3' })
			.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(128);
		await expect(page.locator('video')).toHaveCount(4);
		await expect(page.locator('audio')).toHaveCount(3);
		for (const player of await page.locator('video, audio').all()) {
			await expect.poll(() => player.evaluate((element: HTMLMediaElement) => ({
				loaded: element.readyState >= 1, error: element.error?.code ?? null,
			}))).toEqual({ loaded: true, error: null });
			await player.evaluate(async (element: HTMLMediaElement) => {
				element.muted = true;
				await element.play();
			});
			await expect.poll(() => player.evaluate((element: HTMLMediaElement) => element.currentTime)).toBeGreaterThan(0.1);
			await player.evaluate((element: HTMLMediaElement) => element.pause());
		}
		await page.getByRole('button', { name: 'Show generated image 2 of 3' }).click();
		await page.getByRole('img', { name: 'Generated image 2 of 3' }).scrollIntoViewIfNeeded();
		await page.screenshot({ path: test.info().outputPath('generated-media-chat.png'), fullPage: true });
		await page.reload();
		await expect.poll(() => page.getByRole('img', { name: 'Generated image 1 of 3' })
			.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(64);
		await expect(page.locator('video')).toHaveCount(4);
		await expect(page.locator('audio')).toHaveCount(3);
		await expect(page.getByText('This page crashed')).toHaveCount(0);
	} finally {
		await closeApp(app, userDataDir);
	}
});
