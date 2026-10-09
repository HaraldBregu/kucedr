import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const testRoot = path.join(os.tmpdir(), `kucedr-media-output-${process.pid}`);
const agentDir = path.join(testRoot, 'workspace');
const libraryDir = path.join(testRoot, 'library');
const createImage = jest.fn();
const createVideo = jest.fn();
const createSound = jest.fn();
const parseFile = jest.fn();

jest.mock('../../../../../src/main/shared/agent_location', () => ({
	agentLocation: () => agentDir,
}));
jest.mock('../../../../../src/main/shared/library_location', () => ({
	libraryLocation: () => libraryDir,
}));
jest.mock('../../../../../src/main/models/image', () => ({ createImage }));
jest.mock('../../../../../src/main/models/video', () => ({ createVideo }));
jest.mock('../../../../../src/main/models/sound', () => ({ createSound }));
jest.mock('music-metadata', () => ({ parseFile }));

import { createImageTool } from '../../../../../src/main/agent/tools/media/create_image';
import { createVideoTool } from '../../../../../src/main/agent/tools/media/create_video';
import { createSoundTool } from '../../../../../src/main/agent/tools/media/create_sound';
import { saveSoundFile } from '../../../../../src/main/models/sound/sound_save';
import { saveVideoFile } from '../../../../../src/main/models/video/video_save';
import { listSounds } from '../../../../../src/main/models/sound/sound_list';

beforeEach(async () => {
	await fs.rm(testRoot, { recursive: true, force: true });
	createImage.mockResolvedValue({
		base64: Buffer.from('pixels').toString('base64'),
		mimeType: 'image/png',
	});
	createVideo.mockResolvedValue({
		base64: Buffer.from('frames').toString('base64'),
		mimeType: 'video/mp4',
	});
	createSound.mockResolvedValue({
		base64: Buffer.from('waves').toString('base64'),
		mimeType: 'audio/mpeg',
	});
});

afterAll(async () => {
	await fs.rm(testRoot, { recursive: true, force: true });
});

it.each([
	['image', createImageTool, 'png', 'pixels'],
	['video', createVideoTool, 'mp4', 'frames'],
	['sound', createSoundTool, 'mp3', 'waves'],
] as const)(
	'saves generated %s bytes in Library or the requested destination',
	async (kind, create, extension, bytes) => {
		for (const directory of [undefined, 'exports', path.join(testRoot, 'Chosen # 雨')]) {
			const result = (await create().run({ prompt: 'generate this', directory })) as {
				path: string;
				mimeType: string;
			};
			const destination = directory === undefined ? libraryDir : path.resolve(agentDir, directory);
			expect(path.dirname(result.path)).toBe(destination);
			expect(path.basename(result.path)).toMatch(new RegExp(`^${kind}-.*\\.${extension}$`));
			await expect(fs.readFile(result.path, 'utf8')).resolves.toBe(bytes);
		}
	}
);

it('returns every saved image for chat galleries', async () => {
	createImage
		.mockResolvedValueOnce({ base64: 'Zmlyc3Q=', mimeType: 'image/png' })
		.mockResolvedValueOnce({ base64: 'c2Vjb25k', mimeType: 'image/jpeg' });
	const result = (await createImageTool().run({ prompt: 'two images', count: 2 })) as {
		path: string;
		images: Array<{ path: string; mimeType: string }>;
	};
	expect(result.images).toHaveLength(2);
	expect(result.path).toBe(result.images[0].path);
	expect(result.images.map((image) => path.dirname(image.path))).toEqual([libraryDir, libraryDir]);
	await expect(
		Promise.all(result.images.map((image) => fs.readFile(image.path, 'utf8')))
	).resolves.toEqual(['first', 'second']);
});

it('uses Library for model saves and leaves old files in place', async () => {
	const oldSound = path.join(testRoot, 'sound', 'old.mp3');
	await fs.mkdir(path.dirname(oldSound), { recursive: true });
	await fs.writeFile(oldSound, 'old');
	await saveSoundFile({ base64: 'c291bmQ=', mimeType: 'audio/mpeg' });
	const videoPath = await saveVideoFile({ base64: 'dmlkZW8=', mimeType: 'video/mp4' });
	const sounds = await listSounds();
	expect(sounds).toHaveLength(1);
	expect(path.dirname(sounds[0].path)).toBe(libraryDir);
	await expect(fs.readFile(sounds[0].path, 'utf8')).resolves.toBe('sound');
	expect(path.dirname(videoPath)).toBe(libraryDir);
	await expect(fs.readFile(videoPath, 'utf8')).resolves.toBe('video');
	await expect(fs.readFile(oldSound, 'utf8')).resolves.toBe('old');
	await expect(fs.stat(path.join(libraryDir, 'old.mp3'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('lists audio WebM without including camera/screen video in the shared Library', async () => {
	await fs.mkdir(libraryDir, { recursive: true });
	for (const name of [
		'microphone.webm',
		'camera.webm',
		'screen.webm',
		'broken.webm',
		'image.png',
	]) {
		await fs.writeFile(path.join(libraryDir, name), name);
	}
	parseFile.mockImplementation(async (file: string) => {
		if (file.endsWith('broken.webm')) throw new Error('invalid media');
		return {
			format: {
				hasAudio: !file.endsWith('screen.webm'),
				hasVideo: !file.endsWith('microphone.webm'),
			},
		};
	});
	await expect(listSounds()).resolves.toEqual([
		expect.objectContaining({
			name: 'microphone.webm',
			path: path.join(libraryDir, 'microphone.webm'),
		}),
	]);
});
