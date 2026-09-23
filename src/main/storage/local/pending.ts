import type { DatabaseSync } from 'node:sqlite';
import type { PendingOperation, StorageScope } from './types';

export function listPendingOperations(
	database: DatabaseSync,
	scope: StorageScope
): PendingOperation[] {
	const rows = database.prepare(`SELECT p.account_id, p.workspace_id, p.operation_id,
		v.file_id, v.version_id, v.content_hash, v.content_size, v.blob_path,
		v.kind, v.path, v.device_id, p.status, p.attempts, p.next_retry_at,
		p.uploaded_bytes, p.object_key
		FROM pending_operations p JOIN local_versions v
		ON v.account_id = p.account_id AND v.workspace_id = p.workspace_id
		AND v.version_id = p.version_id
		WHERE p.account_id = ? AND p.workspace_id = ? AND p.status != 'synced'
		ORDER BY v.rowid`).all(scope.accountId, scope.workspaceId) as Array<{
		account_id: string; workspace_id: string; operation_id: string; file_id: string;
		version_id: string; content_hash: string | null; content_size: number | null;
		blob_path: string | null;
		status: 'pending' | 'uploaded'; attempts: number; next_retry_at: string | null;
		kind: PendingOperation['kind']; path: string; device_id: string;
		uploaded_bytes: number; object_key: string | null;
	}>;
	return rows.map((row) => ({
		accountId: row.account_id, workspaceId: row.workspace_id, operationId: row.operation_id,
		fileId: row.file_id, versionId: row.version_id, hash: row.content_hash,
		size: row.content_size, blobPath: row.blob_path, status: row.status,
		attempts: row.attempts, nextRetryAt: row.next_retry_at, kind: row.kind,
		path: row.path, uploadedBytes: row.uploaded_bytes, objectKey: row.object_key,
		deviceId: row.device_id,
		parentIds: (database.prepare(`SELECT parent_id FROM version_parents
			WHERE account_id = ? AND workspace_id = ? AND version_id = ? ORDER BY parent_id`)
			.all(row.account_id, row.workspace_id, row.version_id) as Array<{ parent_id: string }>)
			.map((parent) => parent.parent_id),
	}));
}
