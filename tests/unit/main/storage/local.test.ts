import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openStorageState } from '../../../../src/main/storage/local/state';
import { saveLocalSnapshot } from '../../../../src/main/storage/local/snapshot';
import { listPendingOperations } from '../../../../src/main/storage/local/pending';
import { getOrCreateWorkspaceId } from '../../../../src/main/storage/local/workspace';

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
	const first = getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'work'));
	expect(getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'work'))).toBe(first);
	expect(getOrCreateWorkspaceId(database, 'account-a', path.join(root, 'other'))).not.toBe(first);
	expect(getOrCreateWorkspaceId(database, 'account-b', path.join(root, 'work'))).not.toBe(first);
	database.close();
});
