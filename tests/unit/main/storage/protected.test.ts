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
	writeFileSync(`${root}/settings/providers.json`, '{}');
	writeFileSync(`${root}/settings/cloud-auth.json`, '{}');
	writeFileSync(`${root}/settings/account.json`, '{}');
	writeFileSync(`${root}/providers/openai/manifest.json`, '{}');
	writeFileSync(`${root}/notes.md`, 'safe');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

it.each([
		`${root}/settings/providers.json`,
		`${root}/settings/cloud-auth.json`,
		`${root}/settings/account.json`,
		`${root}/settings`,
		`${root}/providers`,
		`${root}/providers/openai/manifest.json`,
	])('rejects direct file synchronization of %s', (value) => {
		expect(() => normalizeStoragePaths([value])).toThrow('Sensitive application data');
	});

it('excludes provider data when a parent Kucedr folder is selected', async () => {
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
