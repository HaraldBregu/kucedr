import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const getStorageSettings = jest.fn();
jest.mock('../../../../src/main/storage/storage_store', () => ({ getStorageSettings }));
jest.mock('../../../../src/main/storage/storage_prefix', () => ({
	storagePrefix: () => 'kucedr/v1/agent/',
}));
jest.mock('../../../../src/main/storage/storage_protected', () => ({
	isProtectedStoragePath: () => false,
}));

import { pushFiles } from '../../../../src/main/storage/storage_push';
import { pullFiles } from '../../../../src/main/storage/storage_pull';
import type { StorageObjectStore } from '../../../../src/main/storage/remote';
import { listBackupSnapshots } from '../../../../src/main/storage/snapshots';

let directory: string;
let root: string;
let objects: Map<string, Buffer>;
let store: StorageObjectStore;

beforeEach(async () => {
	directory = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'kucedr-snapshot-test-')));
	root = path.join(directory, 'workspace');
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

it('retains snapshots and restores the latest complete backup while preserving local edits', async () => {
	const file = path.join(root, 'notes.md');
	await fs.writeFile(file, 'first');
	expect((await pushFiles(store)).failed).toEqual([]);
	await fs.writeFile(file, 'second');
	expect((await pushFiles(store)).failed).toEqual([]);
	expect([...objects.keys()].filter((key) => key.includes('/snapshots/'))).toHaveLength(2);
	await fs.writeFile(file, 'local edit');
	await fs.writeFile(path.join(root, 'unmatched.md'), 'keep');
	expect((await pullFiles(store)).failed).toEqual([]);
	expect(await fs.readFile(file, 'utf8')).toBe('second');
	expect(await fs.readFile(path.join(root, 'unmatched.md'), 'utf8')).toBe('keep');
	const recovery = await fs.readdir(path.join(root, '.kucedr-recovery'));
	expect(
		await fs.readFile(path.join(root, '.kucedr-recovery', recovery[0], 'notes.md'), 'utf8')
	).toBe('local edit');
	const again = await pullFiles(store);
	expect(again.downloaded).toEqual([]);
	expect(again.skipped).toHaveLength(1);
});

it('does not publish failed backups and restores the prior successful snapshot', async () => {
	await fs.writeFile(path.join(root, 'notes.md'), 'good');
	await pushFiles(store);
	await fs.writeFile(path.join(root, 'notes.md'), 'changed');
	store.putFile = async () => {
		throw new Error('Disconnected');
	};
	expect((await pushFiles(store)).failed).toHaveLength(1);
	expect([...objects.keys()].filter((key) => key.includes('/snapshots/'))).toHaveLength(1);
	await pullFiles(store);
	expect(await fs.readFile(path.join(root, 'notes.md'), 'utf8')).toBe('good');
});

it('rejects corrupt content before changing a local file', async () => {
	await fs.writeFile(path.join(root, 'notes.md'), 'good');
	await pushFiles(store);
	const key = [...objects.keys()].find((key) => key.includes('/files/'))!;
	objects.set(key, Buffer.from('evil'));
	await fs.writeFile(path.join(root, 'notes.md'), 'local');
	expect((await pullFiles(store)).failed[0].error).toContain('integrity');
	expect(await fs.readFile(path.join(root, 'notes.md'), 'utf8')).toBe('local');
	expect((await fs.readdir(root)).some((name) => name.endsWith('.tmp'))).toBe(false);
});

it('streams files larger than 50 MiB and excludes recovery files from backups', async () => {
	const file = path.join(root, 'large.bin');
	await fs.writeFile(file, '');
	await fs.truncate(file, 51 * 1024 * 1024);
	await fs.mkdir(path.join(root, '.kucedr-recovery'));
	await fs.writeFile(path.join(root, '.kucedr-recovery', 'private.md'), 'recovery');
	expect(await pushFiles(store)).toEqual({ uploaded: [file], failed: [] });
	await fs.unlink(file);
	expect((await pullFiles(store)).failed).toEqual([]);
	expect((await fs.stat(file)).size).toBe(51 * 1024 * 1024);
});

it('refuses traversal and symbolic links from a remote snapshot', async () => {
	await fs.writeFile(path.join(root, 'notes.md'), 'good');
	await pushFiles(store);
	const manifestKey = [...objects.keys()].find((key) => key.includes('/snapshots/'))!;
	const manifest = JSON.parse(objects.get(manifestKey)!.toString());
	manifest.files[0].path = '../outside.md';
	objects.set(manifestKey, Buffer.from(JSON.stringify(manifest)));
	expect((await pullFiles(store)).failed).toHaveLength(1);
	manifest.files[0].path = 'link/notes.md';
	objects.set(manifestKey, Buffer.from(JSON.stringify(manifest)));
	await fs.symlink(directory, path.join(root, 'link'));
	expect((await pullFiles(store)).failed).toHaveLength(1);
});

it('lists backup points and restores an older snapshot into a different destination', async () => {
	const file = path.join(root, 'notes.md');
	await fs.writeFile(file, 'original');
	await pushFiles(store);
	await fs.writeFile(file, 'newer');
	await pushFiles(store);
	const snapshots = await listBackupSnapshots(store);
	expect(snapshots).toHaveLength(2);
	expect(snapshots[0]).toMatchObject({ folder: 'workspace', files: 1, bytes: 5 });
	const destination = path.join(directory, 'another-computer');
	expect(
		(await pullFiles(store, { snapshotKey: snapshots[1].key, path: destination })).failed
	).toEqual([]);
	expect(await fs.readFile(path.join(destination, 'notes.md'), 'utf8')).toBe('original');
	expect(await fs.readFile(file, 'utf8')).toBe('newer');
});

it('reports missing backups and rejects an invalid explicit snapshot key', async () => {
	expect((await pullFiles(store)).failed[0].error).toContain('No backup was found');
	await expect(pullFiles(store, { snapshotKey: '../private', path: root })).rejects.toThrow(
		'Invalid backup snapshot key'
	);
});

it('preserves executable permissions and modification time when restoring a file', async () => {
	const file = path.join(root, 'script.sh');
	await fs.writeFile(file, 'echo hello', { mode: 0o755 });
	const modifiedAt = new Date('2025-01-01T00:00:00Z');
	await fs.utimes(file, modifiedAt, modifiedAt);
	await pushFiles(store);
	await fs.unlink(file);
	expect((await pullFiles(store)).failed).toEqual([]);
	const stat = await fs.stat(file);
	expect(stat.mode & 0o777).toBe(0o755);
	expect(stat.mtimeMs).toBe(modifiedAt.getTime());
});

it('refuses to replace local content when the recovery folder is a symlink', async () => {
	const file = path.join(root, 'notes.md');
	await fs.writeFile(file, 'backup');
	await pushFiles(store);
	await fs.writeFile(file, 'local');
	const outside = path.join(directory, 'outside');
	await fs.mkdir(outside);
	await fs.symlink(outside, path.join(root, '.kucedr-recovery'));
	expect((await pullFiles(store)).failed[0].error).toContain('Recovery folder');
	expect(await fs.readFile(file, 'utf8')).toBe('local');
	expect(await fs.readdir(outside)).toEqual([]);
});
