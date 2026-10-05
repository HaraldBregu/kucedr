import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listLibraryFiles } from '../../../../src/main/library/list';

let root = '';

beforeEach(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('creates the library root and lists every regular file recursively', async () => {
	await rm(root, { recursive: true });
	await expect(listLibraryFiles(root)).resolves.toEqual([]);

	await mkdir(path.join(root, 'documents'), { recursive: true });
	await writeFile(path.join(root, 'photo.png'), 'image');
	await writeFile(path.join(root, 'documents', 'notes.txt'), 'notes');

	const files = await listLibraryFiles(root);

	expect(files.map((file) => file.relativePath)).toEqual([
		'documents',
		path.join('documents', 'notes.txt'),
		'photo.png',
	]);
	expect(files).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ name: 'documents', kind: 'folder' }),
			expect.objectContaining({ name: 'notes.txt', size: 5 }),
			expect.objectContaining({ name: 'photo.png', size: 5 }),
		])
	);
});
