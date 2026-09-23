import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { catchUp } from '../../../../src/main/storage/cloud/catchup';
import { scanWorkspace } from '../../../../src/main/storage/cloud/scan';
import { restoreHistoricalVersion } from '../../../../src/main/storage/cloud/restore';
import type { StorageCloudApi } from '../../../../src/main/storage/cloud/api';
import { getSyncCursor } from '../../../../src/main/storage/local/cursor';
import { applyRemoteChange } from '../../../../src/main/storage/local/change';
import { listStorageConflicts } from '../../../../src/main/storage/local/conflicts';
import { listPendingOperations } from '../../../../src/main/storage/local/pending';
import { openStorageState } from '../../../../src/main/storage/local/state';

const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
const scope = { accountId: 'account-a', workspaceId: 'workspace-a' };
let root: string;
let working: string;

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-versioned-sync-'));
	working = path.join(root, 'work');
	mkdirSync(working);
	process.env.KUCEDR_E2E_DATA_ROOT = root;
});

afterEach(() => {
	if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
	else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
	rmSync(root, { recursive: true, force: true });
});

it('records edits and deletions as durable parented pending versions', async () => {
	const database = openStorageState();
	const file = path.join(working, 'notes.txt');
	writeFileSync(file, 'first');
	await scanWorkspace(database, scope, working, 'device-a');
	writeFileSync(file, 'second');
	await scanWorkspace(database, scope, working, 'device-a');
	rmSync(file);
	await scanWorkspace(database, scope, working, 'device-a');
	const pending = listPendingOperations(database, scope);
	expect(pending.map((operation) => operation.kind)).toEqual([
		'content', 'content', 'tombstone',
	]);
	expect(pending[1].parentIds).toEqual([pending[0].versionId]);
	expect(pending[2].parentIds).toEqual([pending[1].versionId]);
	database.close();
});

it('rejects corrupt downloads before advancing the cursor or changing a local edit', async () => {
	const database = openStorageState();
	const local = path.join(working, 'notes.txt');
	writeFileSync(local, 'local edit');
	const expected = Buffer.from('cloud version');
	const hash = createHash('sha256').update(expected).digest('hex');
	const cloud = {
		changes: jest.fn().mockResolvedValue([{
			workspace_id: scope.workspaceId, sequence: 1,
			file_id: 'file-a', version_id: 'version-a',
		}]),
		version: jest.fn().mockResolvedValue({
			id: 'version-a', file_id: 'file-a', workspace_id: scope.workspaceId,
			kind: 'content', path: 'notes.txt', bucket: 'bucket',
			sha256: hash, size_bytes: expected.length, object_key: 'key',
		}),
		parents: jest.fn().mockResolvedValue([]),
		heads: jest.fn().mockResolvedValue(['version-a']),
		download: jest.fn().mockResolvedValue(Buffer.from('wrong content')),
	};
	await expect(catchUp(database, scope, cloud as unknown as StorageCloudApi, working))
		.rejects.toThrow();
	expect(getSyncCursor(database, scope)).toBe('0');
	expect(readFileSync(local, 'utf8')).toBe('local edit');
	cloud.download.mockResolvedValue(expected);
	await catchUp(database, scope, cloud as unknown as StorageCloudApi, working);
	expect(getSyncCursor(database, scope)).toBe('1');
	expect(readFileSync(local, 'utf8')).toBe('local edit');
	expect(existsSync(path.join(root, 'storage', 'blobs'))).toBe(true);
	database.close();
});

it('keeps concurrent edits and edit-versus-delete heads until a merge resolves them', () => {
	const database = openStorageState();
	const change = (sequence: number, versionId: string, parentIds: string[],
		kind: 'content' | 'tombstone' = 'content') => applyRemoteChange(database, scope, {
		sequence: String(sequence), versionId, fileId: 'file-a',
		path: kind === 'tombstone' ? null : 'notes.txt', kind,
		hash: kind === 'tombstone' ? null : 'hash',
		size: kind === 'tombstone' ? null : 4,
		bucket: kind === 'tombstone' ? null : 'bucket',
		key: kind === 'tombstone' ? null : versionId,
		parentIds,
	});
	change(1, 'base', []);
	change(2, 'left', ['base']);
	change(3, 'right', ['base']);
	expect(listStorageConflicts(database, scope).map((item) => item.versionId))
		.toEqual(['left', 'right']);
	change(4, 'deleted', ['left'], 'tombstone');
	expect(new Set(listStorageConflicts(database, scope).map((item) => item.versionId)))
		.toEqual(new Set(['right', 'deleted']));
	change(5, 'merged', ['right', 'deleted']);
	expect(listStorageConflicts(database, scope)).toEqual([]);
	expect(getSyncCursor(database, scope)).toBe('5');
	database.close();
});

it('exposes separate file identities claiming the same path', () => {
	const database = openStorageState();
	for (const [index, fileId] of ['file-a', 'file-b'].entries()) {
		applyRemoteChange(database, scope, {
			sequence: String(index + 1), versionId: `version-${index}`,
			fileId, path: 'same.txt', kind: 'content', hash: 'hash',
			size: 4, bucket: 'bucket', key: `key-${index}`, parentIds: [],
		});
	}
	expect(listStorageConflicts(database, scope).map((item) => item.fileId))
		.toEqual(['file-a', 'file-b']);
	database.close();
});

it('restores historical bytes as a new pending version with current heads as parents', async () => {
	const database = openStorageState();
	const content = Buffer.from('historical bytes');
	const hash = createHash('sha256').update(content).digest('hex');
	const cloud = {
		version: jest.fn().mockResolvedValue({
			id: 'historical', file_id: 'file-a', path: 'notes.txt',
			sha256: hash, size_bytes: content.length,
		}),
		download: jest.fn().mockResolvedValue(content),
		heads: jest.fn().mockResolvedValue(['current']),
	};
	const restoredId = await restoreHistoricalVersion(database, scope,
		cloud as unknown as StorageCloudApi, 'historical', 'device-a');
	const pending = listPendingOperations(database, scope);
	expect(pending).toEqual([expect.objectContaining({
		versionId: restoredId, kind: 'restore', parentIds: ['current'],
	})]);
	expect(readFileSync(pending[0].blobPath!, 'utf8')).toBe('historical bytes');
	database.close();
});
