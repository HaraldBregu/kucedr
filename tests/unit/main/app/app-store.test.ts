import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AppStorage } from '../../../../src/main/apps/app_store';

describe('app storage', () => {
	let root: string;

	beforeEach(() => {
		root = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-store-'));
	});

	afterEach(() => {
		fs.rmSync(root, { recursive: true, force: true });
	});

	it('isolates JSON values by app ID', () => {
		const storage = new AppStorage(root);
		expect(storage.get('draw', 'config')).toBeUndefined();

		storage.set('draw', 'config', { color: 'blue', size: 2 });
		storage.set('demo', 'config', { color: 'red' });

		expect(fs.existsSync(path.join(root, 'draw', 'data', 'store.json'))).toBe(true);
		expect(storage.get('draw', 'config')).toEqual({ color: 'blue', size: 2 });
		expect(storage.get('demo', 'config')).toEqual({ color: 'red' });
		storage.delete('draw', 'config');
		storage.delete('draw', 'missing');
		expect(storage.get('draw', 'config')).toBeUndefined();
	});

	it('rejects invalid keys and values', () => {
		const storage = new AppStorage(root);
		expect(() => storage.set('draw', '', 'value')).toThrow('store key');
		for (const key of ['__proto__', 'constructor', 'prototype', '__internal__']) {
			expect(() => storage.set('draw', key, 'value')).toThrow('store key');
		}
		expect(() => storage.set('draw', 'value', Number.NaN)).toThrow('store value');
		const sparse = new Array(1) as never;
		expect(() => storage.set('draw', 'value', sparse)).toThrow('store value');
		const disguisedSparse = new Array(1) as unknown[] & { extra: boolean };
		disguisedSparse.extra = true;
		expect(() => storage.set('draw', 'value', disguisedSparse as never)).toThrow('store value');
		expect(() => storage.set('../draw', 'value', true)).toThrow('Invalid app ID');
	});

	it('accepts literal dotted keys and repeated JSON object references', () => {
		const storage = new AppStorage(root);
		const shared = { enabled: true };
		storage.set('draw', 'config.theme', { first: shared, second: shared });
		expect(storage.get('draw', 'config.theme')).toEqual({ first: shared, second: shared });
	});

	it('round-trips, overwrites, and deletes nested binary files', async () => {
		const storage = new AppStorage(root);
		await storage.writeFile('draw', 'scenes/current.bin', new Uint8Array([1, 2, 3]));
		expect(fs.existsSync(path.join(root, 'draw', 'data', 'files', 'scenes', 'current.bin'))).toBe(true);
		expect(await storage.readFile('draw', 'scenes/current.bin')).toEqual(new Uint8Array([1, 2, 3]));

		await storage.writeFile('draw', 'scenes/current.bin', new Uint8Array([4, 5]));
		expect(await storage.readFile('draw', 'scenes/current.bin')).toEqual(new Uint8Array([4, 5]));
		await expect(storage.readFile('demo', 'scenes/current.bin')).rejects.toThrow('not found');

		await storage.deleteFile('draw', 'scenes/current.bin');
		await storage.deleteFile('draw', 'scenes/current.bin');
		await expect(storage.readFile('draw', 'scenes/current.bin')).rejects.toThrow('not found');
	});

	it.each(['', '../outside', '/outside', 'C:/outside', 'nested/../outside', 'nested\\outside'])(
		'rejects unsafe file path %p',
		async (filePath) => {
			const storage = new AppStorage(root);
			await expect(storage.writeFile('draw', filePath, new Uint8Array())).rejects.toThrow(
				'Invalid app file path'
			);
		}
	);

	it('rejects directory targets and final file symlinks', async () => {
		const storage = new AppStorage(root);
		await storage.writeFile('draw', '..notes/file.bin', new Uint8Array([1]));
		fs.mkdirSync(path.join(root, 'draw', 'data', 'files', 'folder'));
		await expect(storage.readFile('draw', 'folder')).rejects.toThrow('regular file');

		if (process.platform === 'win32') return;
		const outside = path.join(root, 'outside.bin');
		fs.writeFileSync(outside, 'outside');
		fs.symlinkSync(outside, path.join(root, 'draw', 'data', 'files', 'link.bin'));
		await expect(storage.readFile('draw', 'link.bin')).rejects.toThrow('regular file');
	});

	it('rejects symlinks inside the files folder', async () => {
		if (process.platform === 'win32') return;
		const storage = new AppStorage(root);
		await storage.writeFile('draw', 'safe/file.bin', new Uint8Array([1]));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-outside-'));
		try {
			fs.rmSync(path.join(root, 'draw', 'data', 'files', 'safe'), { recursive: true });
			fs.symlinkSync(outside, path.join(root, 'draw', 'data', 'files', 'safe'));
			await expect(storage.readFile('draw', 'safe/file.bin')).rejects.toThrow(
				'Invalid app storage directory'
			);
			await expect(storage.writeFile('draw', 'safe/file.bin', new Uint8Array([2]))).rejects.toThrow(
				'Invalid app storage directory'
			);
		} finally {
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('rejects a symlinked value store file', () => {
		if (process.platform === 'win32') return;
		const storage = new AppStorage(root);
		const namespace = path.join(root, 'draw', 'data');
		const outside = path.join(root, 'outside.json');
		fs.mkdirSync(namespace, { recursive: true });
		fs.writeFileSync(outside, '{}');
		fs.symlinkSync(outside, path.join(namespace, 'store.json'));

		expect(() => storage.set('draw', 'config', { ready: true })).toThrow(
			'Invalid app store file'
		);
	});

	it('revalidates a cached value store namespace', () => {
		if (process.platform === 'win32') return;
		const storage = new AppStorage(root);
		storage.set('draw', 'config', { ready: true });
		const namespace = path.join(root, 'draw', 'data');
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'kucedr-app-values-'));
		try {
			fs.rmSync(namespace, { recursive: true });
			fs.symlinkSync(outside, namespace);
			expect(() => storage.get('draw', 'config')).toThrow('Invalid app storage directory');
		} finally {
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});
});
