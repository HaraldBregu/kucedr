import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { addLibraryFile } from '../../../../src/main/library/add';

let sourceRoot = '';
let libraryRoot = '';

beforeEach(async () => {
	sourceRoot = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-source-'));
	libraryRoot = await mkdtemp(path.join(os.tmpdir(), 'kucedr-library-target-'));
});

afterEach(async () => {
	await Promise.all([
		rm(sourceRoot, { recursive: true, force: true }),
		rm(libraryRoot, { recursive: true, force: true }),
	]);
});

it('copies uploaded files without overwriting a same-name file', async () => {
	const source = path.join(sourceRoot, 'notes.txt');
	await writeFile(source, 'first');
	const first = await addLibraryFile(source, libraryRoot);
	await writeFile(source, 'second');
	const second = await addLibraryFile(source, libraryRoot);

	expect(first.name).toBe('notes.txt');
	expect(second.name).toBe('notes (2).txt');
	await expect(readFile(first.path, 'utf8')).resolves.toBe('first');
	await expect(readFile(second.path, 'utf8')).resolves.toBe('second');
});
