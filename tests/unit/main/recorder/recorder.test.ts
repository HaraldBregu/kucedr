import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow } from 'electron';
import { createRecorder } from '../../../../src/main/recorder/recorder';

describe('recorder capture ownership', () => {
	let directory: string;

	beforeEach(async () => {
		jest.clearAllMocks();
		directory = await fs.mkdtemp(path.join(os.tmpdir(), 'kucedr-recorder-'));
	});

	afterEach(async () => {
		await fs.rm(directory, { recursive: true, force: true });
	});

	it('uses one trusted capture host and accepts completion only from that host', async () => {
		const firstContents = {
			id: 11,
			getURL: () =>
				pathToFileURL(path.join(app.getAppPath(), 'out/renderer/index.html')).toString(),
			isDestroyed: () => false,
			send: jest.fn(),
		};
		const secondContents = { ...firstContents, id: 12, send: jest.fn() };
		jest.mocked(BrowserWindow.getAllWindows).mockReturnValue([
			{ isDestroyed: () => false, webContents: firstContents },
			{ isDestroyed: () => false, webContents: secondContents },
		] as never);
		const recorder = createRecorder({ command: 'capture:command', event: 'capture:event' });
		const output = path.join(directory, 'capture.webm');

		const recording = recorder.start({ url: output, duration: 1_000 });
		expect(firstContents.send).toHaveBeenCalledWith(
			'capture:command',
			expect.objectContaining({ type: 'start', id: recording.id })
		);
		expect(secondContents.send).not.toHaveBeenCalledWith(
			'capture:command',
			expect.anything()
		);

		await expect(
			recorder.chunk({ id: recording.id, sequence: 0, data: new Uint8Array([1]) }, 12)
		).rejects.toThrow('different capture host');
		await expect(fs.readFile(output)).rejects.toMatchObject({ code: 'ENOENT' });

		await Promise.all([
			recorder.chunk(
				{ id: recording.id, sequence: 0, data: new Uint8Array(Buffer.from('recorded')) },
				11
			),
			recorder.chunk({ id: recording.id, sequence: 1, data: new Uint8Array([33]) }, 11),
		]);
		await recorder.complete({ id: recording.id, mimeType: 'video/webm' }, 11);
		await expect(fs.readFile(output, 'utf8')).resolves.toBe('recorded!');
	});

	it('rejects duplicate sessions and refuses to overwrite an existing output', async () => {
		const contents = {
			id: 11,
			getURL: () => pathToFileURL(path.join(app.getAppPath(), 'out/renderer/index.html')).toString(),
			isDestroyed: () => false,
			send: jest.fn(),
		};
		jest.mocked(BrowserWindow.getAllWindows).mockReturnValue([
			{ isDestroyed: () => false, webContents: contents },
		] as never);
		const recorder = createRecorder({ command: 'capture:command', event: 'capture:event' });
		const output = path.join(directory, 'capture.webm');
		await fs.writeFile(output, 'keep');

		const first = recorder.start({ url: path.join(directory, 'first.webm'), duration: 1_000 });
		expect(() => recorder.start({ url: path.join(directory, 'second.webm'), duration: 1_000 })).toThrow(
			'already in progress'
		);
		recorder.cancel(first.id);
		await expect(fs.readFile(output, 'utf8')).resolves.toBe('keep');
		await expect(recorder.chunk({ id: first.id, sequence: 0, data: new Uint8Array([1]) }, 11)).resolves.toBeUndefined();

		const second = recorder.start({ url: output, duration: 1_000 });
		await expect(
			recorder.chunk({ id: second.id, sequence: 0, data: new Uint8Array([1]) }, 11)
		).rejects.toThrow('already exists');
		expect(recorder.get(second.id)).toMatchObject({ status: 'error' });
		await expect(fs.readFile(output, 'utf8')).resolves.toBe('keep');
	});

	it('preserves chunk order and cleans the file on capture failure', async () => {
		const contents = {
			id: 11,
			getURL: () => pathToFileURL(path.join(app.getAppPath(), 'out/renderer/index.html')).toString(),
			isDestroyed: () => false,
			send: jest.fn(),
		};
		jest.mocked(BrowserWindow.getAllWindows).mockReturnValue([
			{ isDestroyed: () => false, webContents: contents },
		] as never);
		const recorder = createRecorder({ command: 'capture:command', event: 'capture:event' });
		const output = path.join(directory, 'failed.webm');
		const recording = recorder.start({ url: output, duration: 1_000 });
		const first = recorder.chunk({ id: recording.id, sequence: 0, data: new Uint8Array([1]) }, 11);
		const second = recorder.chunk({ id: recording.id, sequence: 1, data: new Uint8Array([2]) }, 11);
		await Promise.all([first, second]);
		await recorder.complete({ id: recording.id, error: 'Capture ended unexpectedly.' }, 11);
		await expect(fs.readFile(output)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(recorder.get(recording.id)).toMatchObject({ status: 'error' });
	});
});
