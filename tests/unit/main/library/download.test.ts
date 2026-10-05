import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { downloadLibraryFiles } from '../../../../src/main/library/download';

const showSaveDialog = jest.fn();
const showOpenDialog = jest.fn();
jest.mock('electron', () => ({ dialog: { showSaveDialog, showOpenDialog } }));

let root = '';
let destination = '';

beforeEach(async () => {
	jest.clearAllMocks();
	root = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-download-'));
	destination = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-export-'));
});

afterEach(async () => {
	await rm(root, { recursive: true, force: true });
	await rm(destination, { recursive: true, force: true });
});

it('exports one file without overwriting an existing destination', async () => {
	await writeFile(path.join(root, 'notes.txt'), 'original');
	const target = path.join(destination, 'notes.txt');
	showSaveDialog.mockResolvedValue({ canceled: false, filePath: target });
	await expect(downloadLibraryFiles({} as never, ['notes.txt'], root)).resolves.toBe(true);
	await expect(readFile(target, 'utf8')).resolves.toBe('original');
	await expect(downloadLibraryFiles({} as never, ['notes.txt'], root)).rejects.toMatchObject({ code: 'EEXIST' });
});

it('exports multiple files while preserving their relative paths', async () => {
	await mkdir(path.join(root, 'documents'));
	await writeFile(path.join(root, 'photo.png'), 'photo');
	await writeFile(path.join(root, 'documents', 'notes.txt'), 'notes');
	showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [destination] });
	await expect(downloadLibraryFiles({} as never, ['photo.png', 'documents/notes.txt'], root)).resolves.toBe(true);
	await expect(readFile(path.join(destination, 'documents', 'notes.txt'), 'utf8')).resolves.toBe('notes');
});

it('rejects traversal and source symlinks', async () => {
	await writeFile(path.join(root, 'notes.txt'), 'notes');
	await symlink(path.join(root, 'notes.txt'), path.join(root, 'linked.txt'));
	await expect(downloadLibraryFiles({} as never, ['../outside.txt'], root)).rejects.toThrow('Library file path must stay inside the library.');
	await expect(downloadLibraryFiles({} as never, ['linked.txt'], root)).rejects.toThrow('Library path is not a regular file.');
	expect(showSaveDialog).not.toHaveBeenCalled();
});
