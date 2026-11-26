import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { create } from 'tar';
import { installPluginArchive } from '../../../../src/main/plugins/plugins_install_archive';
import { refreshPlugins } from '../../../../src/main/plugins/plugins_scan';

const manifest = JSON.stringify({
	schemaVersion: 5,
	id: 'sample',
	title: 'Sample',
	description: 'A sample plugin.',
	author: 'Kucedr',
	version: '1.0.0',
});
const skill = '---\nname: sample\ndescription: Read a sample.\n---\nRead the sample.';
let root: string;
let mockByteLimit: number;
let mockEntryLimit: number;

jest.mock('../../../../src/main/plugins/limits', () => ({
	get MAX_ARCHIVE_BYTES() { return mockByteLimit; },
	get MAX_ARCHIVE_ENTRIES() { return mockEntryLimit; },
}));
jest.mock('../../../../src/main/plugins/plugins_root', () => ({
	pluginsRoot: () => path.join(root, 'installed'),
}));
jest.mock('../../../../src/main/plugins/plugins_bundled_root', () => ({
	bundledPluginsRoot: () => path.join(root, 'bundled'),
}));
jest.mock('../../../../src/main/plugins/plugins_store', () => ({
	pluginsStore: { get: () => [] },
}));

beforeEach(async () => {
	root = await mkdtemp(path.join(os.tmpdir(), 'plugin-archive-test-'));
	await mkdir(path.join(root, 'package', 'skills', 'sample'), { recursive: true });
	await writeFile(path.join(root, 'package', 'manifest.json'), manifest);
	await writeFile(path.join(root, 'package', 'skills', 'sample', 'SKILL.md'), skill);
	await mkdir(path.join(root, 'temporary'));
	jest.spyOn(os, 'tmpdir').mockReturnValue(path.join(root, 'temporary'));
	mockByteLimit = Buffer.byteLength(manifest + skill);
	mockEntryLimit = 5;
	refreshPlugins();
});

afterEach(async () => {
	jest.restoreAllMocks();
	refreshPlugins();
	await rm(root, { recursive: true, force: true });
});

it.each(['root', 'wrapped'])('installs a %s plugin within the archive limits', async (layout) => {
	const file = path.join(root, 'plugin.tgz');
	const wrapped = layout === 'wrapped';
	await create({ file, gzip: true, cwd: wrapped ? root : path.join(root, 'package') },
		wrapped ? ['package'] : ['manifest.json', 'skills']);
	await expect(installPluginArchive(file)).resolves.toMatchObject({ id: 'sample', version: '1.0.0' });
	expect(await readdir(path.join(root, 'temporary'))).toEqual([]);
});

it.each(['bytes', 'entries'])('preserves the installed plugin and cleans up on excess %s', async (limit) => {
	const file = path.join(root, 'plugin.tgz');
	await create({ file, cwd: root, gzip: true }, ['package']);
	await installPluginArchive(file);
	await writeFile(path.join(root, 'package', 'manifest.json'), manifest.replace('1.0.0', '1.0.1'));
	if (limit === 'bytes') mockEntryLimit += 1;
	await writeFile(path.join(root, 'package', 'README.md'), limit === 'bytes' ? 'Sample.' : '');
	await create({ file, cwd: root, gzip: true }, ['package']);
	const message = limit === 'bytes'
		? `The unpacked plugin archive exceeds the limit of ${mockByteLimit} bytes.`
		: `Plugin archives can contain at most ${mockEntryLimit} entries.`;
	await expect(installPluginArchive(file)).rejects.toThrow(message);
	expect(await readFile(path.join(root, 'installed', 'sample', 'manifest.json'), 'utf8')).toBe(manifest);
	expect(await readdir(path.join(root, 'installed'))).toEqual(['sample']);
	expect(await readdir(path.join(root, 'temporary'))).toEqual([]);
});
