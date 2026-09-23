import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { storageLocation } from './paths';
import type { LocalSnapshotInput, LocalSnapshotResult } from './types';

export async function saveLocalSnapshot(
	database: DatabaseSync,
	input: LocalSnapshotInput
): Promise<LocalSnapshotResult> {
	const hash = createHash('sha256').update(input.content).digest('hex');
	const scope = createHash('sha256')
		.update(JSON.stringify([input.accountId, input.workspaceId]))
		.digest('hex');
	const blobDir = path.join(storageLocation(), 'blobs', scope);
	const blobPath = path.join(blobDir, hash);
	const stagingDir = path.join(storageLocation(), 'staging');
	await fs.mkdir(blobDir, { recursive: true, mode: 0o700 });
	await fs.mkdir(stagingDir, { recursive: true, mode: 0o700 });
	const temporary = path.join(stagingDir, randomUUID());
	try {
		const handle = await fs.open(temporary, 'wx', 0o600);
		try {
			await handle.writeFile(input.content);
			await handle.sync();
		} finally {
			await handle.close();
		}
		try {
			await fs.link(temporary, blobPath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}
		const dir = await fs.open(blobDir, 'r');
		try {
			await dir.sync();
		} finally {
			await dir.close();
		}
	} finally {
		await fs.rm(temporary, { force: true });
	}
	database.exec('BEGIN IMMEDIATE');
	try {
		database.prepare(`INSERT INTO local_versions
			(account_id, workspace_id, version_id, file_id, path, content_hash, content_size,
			 blob_path, device_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
			.run(input.accountId, input.workspaceId, input.versionId, input.fileId, input.path,
				hash, input.content.byteLength, blobPath, input.deviceId, new Date().toISOString());
		const parent = database.prepare(`INSERT INTO version_parents
			(account_id, workspace_id, version_id, parent_id) VALUES (?, ?, ?, ?)`);
		for (const parentId of new Set(input.parentIds)) {
			parent.run(input.accountId, input.workspaceId, input.versionId, parentId);
		}
		database.prepare(`INSERT INTO pending_operations
			(account_id, workspace_id, operation_id, version_id, status) VALUES (?, ?, ?, ?, 'pending')`)
			.run(input.accountId, input.workspaceId, input.operationId, input.versionId);
		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
	return { hash, size: input.content.byteLength, blobPath, status: 'pending' };
}
