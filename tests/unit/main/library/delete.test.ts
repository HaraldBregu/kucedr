import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deleteLibraryEntry } from '../../../../src/main/library/delete';

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

	await deleteLibraryEntry('notes.txt', root);
	await expect(access(target)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('deletes a folder and its contents without following symlinks outside the library', async () => {
	const outside = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-preserve-'));
	try {
		await mkdir(path.join(root, 'Projects', 'Nested'), { recursive: true });
		await writeFile(path.join(root, 'Projects', 'Nested', 'notes.txt'), 'notes');
		await writeFile(path.join(outside, 'keep.txt'), 'keep');
		await symlink(outside, path.join(root, 'Projects', 'outside'));

		await deleteLibraryEntry('Projects', root);

		await expect(access(path.join(root, 'Projects'))).rejects.toMatchObject({ code: 'ENOENT' });
		await expect(readFile(path.join(outside, 'keep.txt'), 'utf8')).resolves.toBe('keep');
	} finally {
		await rm(outside, { recursive: true, force: true });
	}
});

it('rejects paths outside the library', async () => {
	await expect(deleteLibraryEntry('../outside.txt', root)).rejects.toThrow(
		'Library path must stay inside the library.'
	);
	await expect(deleteLibraryEntry('.', root)).rejects.toThrow(
		'Library path must stay inside the library.'
	);
	await expect(deleteLibraryEntry(root, root)).rejects.toThrow(
		'Library path must stay inside the library.'
	);
});
