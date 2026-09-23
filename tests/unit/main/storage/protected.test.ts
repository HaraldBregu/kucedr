import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

const root = '/tmp/kucedr-storage-protected-test';

jest.mock('../../../../src/main/shared/user_data_location', () => ({
	userDataLocation: () => root,
}));

import { normalizeStoragePaths } from '../../../../src/main/storage/storage_paths';
import { walkFiles } from '../../../../src/main/storage/storage_walk';

beforeEach(() => {
	rmSync(root, { recursive: true, force: true });
	mkdirSync(`${root}/settings`, { recursive: true });
	mkdirSync(`${root}/providers/openai`, { recursive: true });
	mkdirSync(`${root}/storage/blobs`, { recursive: true });
	writeFileSync(`${root}/providers/settings.json`, '{}');
	writeFileSync(`${root}/settings/account.json`, '{}');
	writeFileSync(`${root}/providers/openai/manifest.json`, '{}');
	writeFileSync(`${root}/storage/state.sqlite`, 'private');
	writeFileSync(`${root}/storage/blobs/pending`, 'unsynced');
	writeFileSync(`${root}/notes.md`, 'safe');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

it.each([
	`${root}/providers/settings.json`,
	`${root}/settings/account.json`,
	`${root}/settings`,
	`${root}/providers`,
	`${root}/providers/openai/manifest.json`,
	`${root}/storage`,
	`${root}/storage/state.sqlite`,
	`${root}/storage/blobs/pending`,
])('rejects direct file synchronization of %s', (value) => {
	expect(() => normalizeStoragePaths([value])).toThrow('Sensitive application data');
});

it('excludes provider and sync state when a parent Kucedr folder is selected', async () => {
	await expect(walkFiles(root)).resolves.toEqual([`${root}/notes.md`]);
});

it('rejects a path that reaches sensitive data through an intermediate symbolic link', () => {
	const aliasRoot = `${root}-alias`;
	rmSync(aliasRoot, { recursive: true, force: true });
	mkdirSync(aliasRoot, { recursive: true });
	symlinkSync(root, `${aliasRoot}/profile`);

	expect(() => normalizeStoragePaths([`${aliasRoot}/profile/settings`])).toThrow(
		'Sensitive application data'
	);
	rmSync(aliasRoot, { recursive: true, force: true });
});
