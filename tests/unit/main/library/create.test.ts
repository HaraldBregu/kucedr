import { access, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLibraryFolder } from '../../../../src/main/library/create';
import { listLibraryFiles } from '../../../../src/main/library/list';

let root = '';

beforeEach(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-folder-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('creates a visible folder in the library', async () => {
	await createLibraryFolder('Projects', root);
	await expect(access(path.join(root, 'Projects'))).resolves.toBeUndefined();
	await expect(listLibraryFiles(root)).resolves.toEqual([
		expect.objectContaining({ name: 'Projects', kind: 'folder' }),
	]);
});

it('creates a folder inside the current library folder', async () => {
	await createLibraryFolder('Projects', root);
	await createLibraryFolder('Notes', root, 'Projects');
	await expect(access(path.join(root, 'Projects', 'Notes'))).resolves.toBeUndefined();
	await expect(listLibraryFiles(root)).resolves.toEqual(
		expect.arrayContaining([
			expect.objectContaining({ relativePath: path.join('Projects', 'Notes'), kind: 'folder' }),
		])
	);
});

it('rejects traversal and duplicate names', async () => {
	await expect(createLibraryFolder('../outside', root)).rejects.toThrow(
		'Invalid library folder name.'
	);
	await createLibraryFolder('Projects', root);
	await expect(createLibraryFolder('Projects', root)).rejects.toMatchObject({ code: 'EEXIST' });
});
