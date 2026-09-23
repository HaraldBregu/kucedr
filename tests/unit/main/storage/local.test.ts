import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStorageState } from '../../../../src/main/storage/local/state';
import { saveLocalSnapshot } from '../../../../src/main/storage/local/snapshot';
import { listPendingOperations } from '../../../../src/main/storage/local/pending';
import { getOrCreateWorkspaceId } from '../../../../src/main/storage/local/workspace';
import { readStorageConfig } from '../../../../src/main/storage/local/config';
import { writeStorageConfig } from '../../../../src/main/storage/local/config_write';
import { storageLocation } from '../../../../src/main/storage/local/paths';
import type { StorageConfig } from '../../../../src/main/storage/local/types';
import { installVerifiedDownload } from '../../../../src/main/storage/local/install';
import { migrateLegacyStorageSettings } from '../../../../src/main/storage/local/migrate';
import { createHash } from 'node:crypto';

const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-storage-local-'));
	process.env.KUCEDR_E2E_DATA_ROOT = root;
});

afterEach(() => {
	if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
	else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
	rmSync(root, { recursive: true, force: true });
});

const scope = { accountId: 'account-a', workspaceId: 'workspace-a' };

it('keeps an immutable pending snapshot and its operation across a restart', async () => {
	const database = openStorageState();
	const saved = await saveLocalSnapshot(database, {
		...scope,
		fileId: 'file-a',
		versionId: 'version-a',
		operationId: 'operation-a',
		path: 'notes/today.md',
		parentIds: ['older-version'],
		content: Buffer.from('offline edit'),
		deviceId: 'device-a',
	});
	expect(saved.status).toBe('pending');
	expect(readFileSync(saved.blobPath)).toEqual(Buffer.from('offline edit'));
	database.close();

	const reopened = openStorageState();
	expect(listPendingOperations(reopened, scope)).toEqual([
		expect.objectContaining({
			operationId: 'operation-a',
			versionId: 'version-a',
			blobPath: saved.blobPath,
			status: 'pending',
		}),
	]);
	expect(
		reopened.prepare('SELECT parent_id FROM version_parents WHERE version_id = ?').get('version-a')
	).toEqual({ parent_id: 'older-version' });
	reopened.close();
});

it('isolates pending operations by account and workspace', async () => {
	const database = openStorageState();
	await saveLocalSnapshot(database, {
		...scope,
		fileId: 'file-a',
		versionId: 'version-a',
		operationId: 'operation-a',
		path: 'notes/today.md',
		parentIds: [],
		content: Buffer.from('private edit'),
		deviceId: 'device-a',
	});
	expect(listPendingOperations(database, { accountId: 'account-b', workspaceId: scope.workspaceId }))
		.toEqual([]);
	expect(listPendingOperations(database, { accountId: scope.accountId, workspaceId: 'workspace-b' }))
		.toEqual([]);
	expect(listPendingOperations(database, scope)).toHaveLength(1);
	database.close();
});

it('rolls back duplicate local publication records without losing the first pending edit', async () => {
	const database = openStorageState();
	const input = {
		...scope,
		fileId: 'file-a',
		versionId: 'version-a',
		operationId: 'operation-a',
		path: 'notes/today.md',
		parentIds: [],
		content: Buffer.from('first edit'),
		deviceId: 'device-a',
	};
	const saved = await saveLocalSnapshot(database, input);
	await expect(saveLocalSnapshot(database, { ...input, content: Buffer.from('second edit') }))
		.rejects.toThrow();
	expect(listPendingOperations(database, scope)).toEqual([
		expect.objectContaining({ operationId: 'operation-a', blobPath: saved.blobPath }),
	]);
	expect(readFileSync(saved.blobPath)).toEqual(Buffer.from('first edit'));
	database.close();
});

it('keeps workspace identities stable and separate for distinct roots and accounts', () => {
	const database = openStorageState();
	const first = getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'work'), 'workspace-a');
	expect(getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'work'), 'workspace-a'))
		.toBe(first);
	expect(getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'other'), 'workspace-b'))
		.not.toBe(first);
	expect(getOrCreateWorkspaceId(database, 'account-b', path.join(root, 'work'), 'workspace-c'))
		.not.toBe(first);
	expect(() => getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'work'), 'workspace-d'))
		.toThrow('already paired');
	database.close();
});

const config: StorageConfig = {
	version: 1,
	provider: 's3',
	providerId: '123e4567-e89b-42d3-a456-426614174000',
	s3: { bucket: 'bucket', region: 'eu-west-1', prefix: 'versions/' },
	supabase: { url: 'https://example.supabase.co' },
	sync: { enabled: true, maxCacheBytes: 1000 },
	workspaces: [],
};

it('keeps secrets out of config.json when writing a configuration', async () => {
	await writeStorageConfig(config);
	const file = path.join(storageLocation(), 'config.json');
	const withSecret = {
		...config,
		s3: { ...config.s3, secretAccessKey: 'must-never-be-written' },
	};
	await writeStorageConfig(withSecret);
	expect(readFileSync(file, 'utf8')).not.toContain('must-never-be-written');
	expect(readFileSync(file, 'utf8')).not.toContain('secretAccessKey');
});

it('rejects an incompatible config version without replacing it', async () => {
	mkdirSync(storageLocation(), { recursive: true });
	const file = path.join(storageLocation(), 'config.json');
	const newer = JSON.stringify({ ...config, version: 2 });
	writeFileSync(file, newer);
	await expect(readStorageConfig()).rejects.toThrow('Invalid storage configuration');
	expect(readFileSync(file, 'utf8')).toBe(newer);
});

it('rejects corrupt downloads and installs only hash-verified content', async () => {
	const content = Buffer.from('published content');
	const hash = createHash('sha256').update(content).digest('hex');
	await expect(installVerifiedDownload(scope, Buffer.from('corrupt'), hash))
		.rejects.toThrow('SHA-256');
	const installed = await installVerifiedDownload(scope, content, hash);
	expect(readFileSync(installed)).toEqual(content);
});

it('records legacy settings without removing or rewriting the source', async () => {
	const database = openStorageState();
	const settings = path.join(root, 'settings');
	mkdirSync(settings, { recursive: true });
	const source = path.join(settings, 'app.json');
	const original = JSON.stringify({
		cloud: {
			providerId: 'old-provider', paths: ['/tmp/old-folder'],
			syncEnabled: true, syncCronExpression: '0 3 * * *',
		},
	});
	writeFileSync(source, original);
	await migrateLegacyStorageSettings(database);
	expect(readFileSync(source, 'utf8')).toBe(original);
	expect(database.prepare('SELECT settings_json FROM legacy_storage_sources').get())
		.toEqual({
			settings_json: JSON.stringify({
				providerId: 'old-provider', paths: ['/tmp/old-folder'],
				syncEnabled: true, syncCronExpression: '0 3 * * *',
			}),
		});
	await migrateLegacyStorageSettings(database);
	expect(database.prepare('SELECT count(*) AS count FROM legacy_storage_sources').get())
		.toEqual({ count: 1 });
	database.close();
});

it('does not reset a corrupt or newer local state database', () => {
	mkdirSync(storageLocation(), { recursive: true });
	const file = path.join(storageLocation(), 'state.sqlite');
	const corrupt = Buffer.from('not a sqlite database');
	writeFileSync(file, corrupt);
	expect(() => openStorageState()).toThrow();
	expect(readFileSync(file)).toEqual(corrupt);
	rmSync(file);
	const database = openStorageState();
	database.exec('PRAGMA user_version = 99');
	database.close();
	expect(() => openStorageState()).toThrow('newer application');
	expect(readFileSync(file).length).toBeGreaterThan(0);
});
