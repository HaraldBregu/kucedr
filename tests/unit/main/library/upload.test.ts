import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { addLibraryFiles } from '../../../../src/main/library/upload';

let sourceRoot = '';
let libraryRoot = '';

beforeEach(async () => {
	sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-upload-source-'));
	libraryRoot = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-upload-target-'));
});

afterEach(async () => {
	await Promise.all([
		rm(sourceRoot, { recursive: true, force: true }),
		rm(libraryRoot, { recursive: true, force: true }),
	]);
});

it('uploads into the open folder and returns a path relative to the library root', async () => {
	await mkdir(path.join(libraryRoot, 'Projects'));
	const source = path.join(sourceRoot, 'notes.txt');
	await writeFile(source, 'notes');

	const files = await addLibraryFiles([source], 'Projects', libraryRoot);

	expect(files).toEqual([
		expect.objectContaining({
			name: 'notes.txt',
			relativePath: path.join('Projects', 'notes.txt'),
		}),
	]);
	await expect(readFile(path.join(libraryRoot, 'Projects', 'notes.txt'), 'utf8')).resolves.toBe(
		'notes'
	);
});

it('rejects upload destinations outside the library', async () => {
	await expect(addLibraryFiles([], '../outside', libraryRoot)).rejects.toThrow(
		'Library folder must stay inside the library.'
	);
});
