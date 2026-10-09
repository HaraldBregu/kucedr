import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const testRoot = path.join(os.tmpdir(), 'kucedr-media-save-test');
const agentDir = path.join(testRoot, 'workspace');
const libraryDir = path.join(testRoot, 'library');

jest.mock('../../../../../src/main/shared/agent_location', () => ({
	agentLocation: (): string => agentDir,
}));
jest.mock('../../../../../src/main/shared/library_location', () => ({
	libraryLocation: (): string => libraryDir,
}));

import { saveMedia } from '../../../../../src/main/shared/media';
import { mediaDirectory } from '../../../../../src/main/shared/media_directory';

describe('saveMedia', () => {
	beforeEach(async () => {
		await fs.rm(testRoot, { recursive: true, force: true });
	});

	afterAll(async () => {
		await fs.rm(testRoot, { recursive: true, force: true });
	});

	it('saves into the library directory when no directory is given', async () => {
		const filePath = await saveMedia('image', 'png', Buffer.from('pixels').toString('base64'));

		expect(path.dirname(filePath)).toBe(libraryDir);
		expect(path.basename(filePath)).toMatch(/^image-\d+-[\da-f-]+\.png$/);
		await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('pixels');
	});

	it('honors absolute and home-relative requested directories', async () => {
		const target = path.join(testRoot, 'Requested # 雨');
		const filePath = await saveMedia('video', 'mp4', Buffer.from('frames').toString('base64'), target);
		expect(path.dirname(filePath)).toBe(target);
		await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('frames');
		expect(mediaDirectory('~/Movies')).toBe(path.join(os.homedir(), 'Movies'));
		expect(mediaDirectory('.')).toBe(agentDir);
	});

	it('keeps concurrent files distinct even in the same millisecond', async () => {
		jest.spyOn(Date, 'now').mockReturnValue(123);
		const files = await Promise.all(['one', 'two'].map((text) =>
			saveMedia('image', 'png', Buffer.from(text).toString('base64'))
		));
		expect(new Set(files).size).toBe(2);
		await expect(Promise.all(files.map((file) => fs.readFile(file, 'utf8')))).resolves.toEqual(['one', 'two']);
	});

	it('does not write a file when cancelled', async () => {
		const controller = new AbortController();
		controller.abort(new Error('cancel media'));
		await expect(saveMedia('image', 'png', 'aW1hZ2U=', undefined, controller.signal)).rejects.toThrow('cancel media');
		await expect(fs.stat(libraryDir)).rejects.toMatchObject({ code: 'ENOENT' });
	});

	it('saves into a requested directory resolved against the agent directory', async () => {
		const filePath = await saveMedia(
			'sound',
			'mp3',
			Buffer.from('waves').toString('base64'),
			'clips/today'
		);

		expect(path.dirname(filePath)).toBe(path.join(agentDir, 'clips', 'today'));
		await expect(fs.readFile(filePath, 'utf8')).resolves.toBe('waves');
	});
});
