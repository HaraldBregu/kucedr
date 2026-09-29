import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deleteLibraryFile } from '../../../../src/main/library/delete';

let root = '';

beforeEach(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-delete-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('deletes a regular file inside the library', async () => {
	const target = path.join(root, 'notes.txt');
	await writeFile(target, 'notes');

	await deleteLibraryFile('notes.txt', root);
	await expect(access(target)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('rejects paths outside the library', async () => {
	await expect(deleteLibraryFile('../outside.txt', root)).rejects.toThrow(
		'Library file path must stay inside the library.'
	);
});
