import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { moveLibraryEntries } from '../../../../src/main/library/move';

let root = '';

beforeEach(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-move-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('moves selected files into a folder', async () => {
	await mkdir(path.join(root, 'Projects'));
	await writeFile(path.join(root, 'one.txt'), 'one');
	await writeFile(path.join(root, 'two.txt'), 'two');
	await moveLibraryEntries(['one.txt', 'two.txt'], 'Projects', root);
	await expect(readFile(path.join(root, 'Projects', 'one.txt'), 'utf8')).resolves.toBe('one');
	await expect(readFile(path.join(root, 'Projects', 'two.txt'), 'utf8')).resolves.toBe('two');
	await expect(access(path.join(root, 'one.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('moves a folder with its contents into another folder', async () => {
	await mkdir(path.join(root, 'Projects'));
	await mkdir(path.join(root, 'Archive'));
	await writeFile(path.join(root, 'Projects', 'notes.txt'), 'notes');
	await moveLibraryEntries(['Projects'], 'Archive', root);
	await expect(readFile(path.join(root, 'Archive', 'Projects', 'notes.txt'), 'utf8')).resolves.toBe('notes');
});

it('rejects moves into itself or a descendant folder', async () => {
	await mkdir(path.join(root, 'Projects', 'Nested'), { recursive: true });
	await expect(moveLibraryEntries(['Projects'], 'Projects', root)).rejects.toThrow('A folder cannot be moved into itself.');
	await expect(moveLibraryEntries(['Projects'], 'Projects/Nested', root)).rejects.toThrow('A folder cannot be moved into itself.');
});

it('rejects collisions before moving any selected file', async () => {
	await mkdir(path.join(root, 'Projects'));
	await writeFile(path.join(root, 'one.txt'), 'source');
	await writeFile(path.join(root, 'two.txt'), 'two');
	await writeFile(path.join(root, 'Projects', 'two.txt'), 'existing');
	await expect(moveLibraryEntries(['one.txt', 'two.txt'], 'Projects', root)).rejects.toThrow('An item with this name already exists in the folder.');
	await expect(readFile(path.join(root, 'one.txt'), 'utf8')).resolves.toBe('source');
	await expect(readFile(path.join(root, 'Projects', 'two.txt'), 'utf8')).resolves.toBe('existing');
});

it('rejects traversal and symlink sources or destinations', async () => {
	await mkdir(path.join(root, 'Projects'));
	await writeFile(path.join(root, 'one.txt'), 'one');
	await symlink(path.join(root, 'one.txt'), path.join(root, 'linked.txt'));
	await symlink(path.join(root, 'Projects'), path.join(root, 'LinkedProjects'));
	await expect(moveLibraryEntries(['../outside.txt'], 'Projects', root)).rejects.toThrow('Library source must stay inside the library.');
	await expect(moveLibraryEntries(['one.txt'], '../outside', root)).rejects.toThrow('Library destination must stay inside the library.');
	await expect(moveLibraryEntries(['linked.txt'], 'Projects', root)).rejects.toThrow('Library symlinks cannot be moved.');
	await expect(moveLibraryEntries(['one.txt'], 'LinkedProjects', root)).rejects.toThrow('Library destination is not a regular folder.');
});
