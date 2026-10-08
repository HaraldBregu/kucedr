import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const getStorageSettings = jest.fn();
jest.mock('../../../../src/main/storage/storage_store', () => ({ getStorageSettings }));
jest.mock('../../../../src/main/storage/storage_protected', () => ({
	isProtectedStoragePath: () => false,
}));

import { pushFiles } from '../../../../src/main/storage/storage_push';
import { pullFiles } from '../../../../src/main/storage/storage_pull';
import { normalizeStoragePaths } from '../../../../src/main/storage/storage_paths';
import { normalizeStorageProvider } from '../../../../src/main/storage/providers/normalize';
import type { StorageObjectStore } from '../../../../src/main/storage/remote';

let directory: string;
let root: string;
let objects: Map<string, Buffer>;
let store: StorageObjectStore;

beforeEach(async () => {
	directory = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'kucedr-files-test-')));
	root = path.join(directory, 'freelance');
	await fs.mkdir(root);
	getStorageSettings.mockReturnValue({ paths: [root] });
	objects = new Map();
	store = {
		get: async (key) => {
			const value = objects.get(key);
			if (!value) throw new Error('Missing object');
			return value;
		},
		put: async (key, value) => {
			objects.set(key, Buffer.from(value));
		},
		list: async (prefix = '') =>
			[...objects]
				.filter(([key]) => key.startsWith(prefix))
				.map(([key, data]) => ({ key, size: data.length, lastModified: undefined })),
		putFile: async (key, file) => {
			objects.set(key, await fs.readFile(file));
		},
		getFile: async (key, file) => {
			await fs.writeFile(file, await store.get(key), { flag: 'wx' });
		},
	};
});

afterEach(async () => {
	await fs.rm(directory, { recursive: true, force: true });
});

it('uploads a plain folder tree and replaces the same object on subsequent uploads', async () => {
	await fs.mkdir(path.join(root, 'invoices'));
	const file = path.join(root, 'invoices', 'invoice.pdf');
	await fs.writeFile(file, 'first');
	expect(await pushFiles(store)).toEqual({ uploaded: [file], failed: [] });
	expect([...objects.keys()]).toEqual(['freelance/invoices/invoice.pdf']);
	await fs.writeFile(file, 'second');
	await pushFiles(store);
	expect([...objects.keys()]).toEqual(['freelance/invoices/invoice.pdf']);
	expect(objects.get('freelance/invoices/invoice.pdf')!.toString()).toBe('second');
});

it('downloads matching objects directly without creating recovery copies or removing other local files', async () => {
	await fs.writeFile(path.join(root, 'notes.md'), 'local');
	await fs.writeFile(path.join(root, 'unmatched.md'), 'keep');
	objects.set('freelance/notes.md', Buffer.from('remote'));
	expect(await pullFiles(store)).toEqual({
		downloaded: ['freelance/notes.md'],
		skipped: [],
		failed: [],
	});
	expect(await fs.readFile(path.join(root, 'notes.md'), 'utf8')).toBe('remote');
	expect((await fs.readdir(root)).sort()).toEqual(['notes.md', 'unmatched.md']);
});

it('transfers files larger than 50 MiB without creating manifests', async () => {
	const file = path.join(root, 'large.bin');
	await fs.writeFile(file, '');
	await fs.truncate(file, 51 * 1024 * 1024);
	expect((await pushFiles(store)).failed).toEqual([]);
	expect([...objects.keys()]).toEqual(['freelance/large.bin']);
	await fs.unlink(file);
	expect((await pullFiles(store)).failed).toEqual([]);
	expect((await fs.stat(file)).size).toBe(51 * 1024 * 1024);
});

it('reports individual upload failures and retains successful uploads', async () => {
	await fs.writeFile(path.join(root, 'good.md'), 'good');
	await fs.writeFile(path.join(root, 'bad.md'), 'bad');
	const upload = store.putFile!;
	store.putFile = async (key, file) => {
		if (key.endsWith('bad.md')) throw new Error('Disconnected');
		await upload(key, file);
	};
	const result = await pushFiles(store);
	expect(result.uploaded).toEqual([path.join(root, 'good.md')]);
	expect(result.failed).toEqual([{ path: path.join(root, 'bad.md'), error: 'Disconnected' }]);
	expect([...objects.keys()]).toEqual(['freelance/good.md']);
});

it('rejects traversal and symbolic links during downloads', async () => {
	objects.set('freelance/../outside.md', Buffer.from('unsafe'));
	expect((await pullFiles(store)).failed).toHaveLength(1);
	objects.clear();
	objects.set('freelance/link/notes.md', Buffer.from('unsafe'));
	await fs.symlink(directory, path.join(root, 'link'));
	expect((await pullFiles(store)).failed).toHaveLength(1);
});

it('rejects ambiguous selected folders with the same name', () => {
	expect(() => normalizeStoragePaths(['/data/first/freelance', '/data/second/freelance'])).toThrow(
		'different names'
	);
});

it('normalizes bucket-scoped endpoints to prevent duplicated bucket paths', () => {
	const provider = {
		name: 'Storage',
		endpoint: 'https://objects.example.com/kucedr-app/',
		region: 'auto',
		bucket: 'kucedr-app',
		accessKeyId: 'access',
		secretAccessKey: 'secret',
		forcePathStyle: true,
	};
	expect(normalizeStorageProvider(provider).endpoint).toBe('https://objects.example.com');
	expect(
		normalizeStorageProvider({
			...provider,
			endpoint: 'https://objects.example.com/storage/v1/s3/kucedr-app',
		}).endpoint
	).toBe('https://objects.example.com/storage/v1/s3');
	expect(
		normalizeStorageProvider({ ...provider, endpoint: 'https://objects.example.com/storage/v1/s3' })
			.endpoint
	).toBe('https://objects.example.com/storage/v1/s3');
});
