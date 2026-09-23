import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { drainPending } from '../../../../src/main/storage/cloud/drain';
import type { StorageCloudApi } from '../../../../src/main/storage/cloud/api';
import { listPendingOperations } from '../../../../src/main/storage/local/pending';
import { saveLocalSnapshot } from '../../../../src/main/storage/local/snapshot';
import { openStorageState } from '../../../../src/main/storage/local/state';
import type { LocalSnapshotInput } from '../../../../src/main/storage/local/types';

const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
const scope = { accountId: 'account-a', workspaceId: 'workspace-a' };
let root: string;

beforeEach(() => {
	root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-storage-drain-'));
	process.env.KUCEDR_E2E_DATA_ROOT = root;
});

afterEach(() => {
	if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
	else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
	rmSync(root, { recursive: true, force: true });
});

function cloud() {
	return {
		reserveUpload: jest.fn().mockResolvedValue({ bucket: 'bucket', key: 'immutable-key' }),
		upload: jest.fn().mockResolvedValue(undefined),
		publish: jest.fn().mockResolvedValue({ sequence: 7, heads: ['version-a'] }),
		version: jest.fn().mockResolvedValue({
			bucket: 'bucket', object_key: 'parent-key', sha256: 'hash', size_bytes: 4,
		}),
	};
}

function input(overrides: Partial<LocalSnapshotInput> = {}): LocalSnapshotInput {
	return {
		...scope,
		fileId: 'file-a', versionId: 'version-a', operationId: 'operation-a',
		path: 'notes/today.md', parentIds: [], content: Buffer.from('offline edit'),
		deviceId: 'device-a',
		...overrides,
	};
}

it('recovers an offline edit after reconnecting without losing its blob', async () => {
	const database = openStorageState();
	const saved = await saveLocalSnapshot(database, input());
	const remote = cloud();
	remote.reserveUpload.mockRejectedValueOnce(new Error('offline'));
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 0, failed: 1 });
	expect(existsSync(saved.blobPath!)).toBe(true);
	expect(listPendingOperations(database, scope)[0]).toMatchObject({
		status: 'pending', attempts: 1,
	});
	database.prepare('UPDATE pending_operations SET next_retry_at = NULL').run();
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 1, failed: 0 });
	expect(listPendingOperations(database, scope)).toEqual([]);
	expect(remote.upload).toHaveBeenCalledTimes(1);
	database.close();
});

it('retries a lost publication response with the same identity without uploading again', async () => {
	const database = openStorageState();
	await saveLocalSnapshot(database, input());
	const remote = cloud();
	remote.publish.mockRejectedValueOnce(new Error('response lost'));
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 0, failed: 1 });
	expect(listPendingOperations(database, scope)[0].status).toBe('uploaded');
	database.prepare('UPDATE pending_operations SET next_retry_at = NULL').run();
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 1, failed: 0 });
	expect(remote.upload).toHaveBeenCalledTimes(1);
	expect(remote.publish).toHaveBeenCalledTimes(2);
	expect(remote.publish.mock.calls[0][0]).toEqual(remote.publish.mock.calls[1][0]);
	database.close();
});

it('keeps a pending content blob when publication fails', async () => {
	const database = openStorageState();
	const saved = await saveLocalSnapshot(database, input());
	const remote = cloud();
	remote.publish.mockRejectedValue(new Error('database unavailable'));
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 0, failed: 1 });
	expect(existsSync(saved.blobPath!)).toBe(true);
	expect(listPendingOperations(database, scope)).toEqual([
		expect.objectContaining({ operationId: 'operation-a', status: 'uploaded' }),
	]);
	database.close();
});

it('publishes tombstones without uploading content', async () => {
	const database = openStorageState();
	await saveLocalSnapshot(database, input({
		kind: 'tombstone', content: undefined, parentIds: ['old-version'],
	}));
	const remote = cloud();
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 1, failed: 0 });
	expect(remote.reserveUpload).not.toHaveBeenCalled();
	expect(remote.upload).not.toHaveBeenCalled();
	expect(remote.publish).toHaveBeenCalledWith(expect.objectContaining({
		kind: 'tombstone', path: null, parentIds: ['old-version'],
	}));
	database.close();
});

it('publishes renames with the parent content reference without uploading again', async () => {
	const database = openStorageState();
	database.prepare(`INSERT INTO local_files (account_id, workspace_id, file_id, relative_path)
		VALUES (?, ?, ?, ?)`).run(scope.accountId, scope.workspaceId, 'file-a', 'notes/old.md');
	await saveLocalSnapshot(database, input({
		kind: 'rename', content: undefined, parentIds: ['old-version'],
	}));
	const remote = cloud();
	expect(await drainPending(database, scope, remote as unknown as StorageCloudApi))
		.toEqual({ synced: 1, failed: 0 });
	expect(remote.version).toHaveBeenCalledWith(scope.workspaceId, 'old-version');
	expect(remote.reserveUpload).not.toHaveBeenCalled();
	expect(remote.upload).not.toHaveBeenCalled();
	expect(remote.publish).toHaveBeenCalledWith(expect.objectContaining({
		kind: 'rename', key: 'parent-key', path: 'notes/today.md',
	}));
	database.close();
});
