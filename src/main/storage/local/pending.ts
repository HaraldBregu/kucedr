import type { DatabaseSync } from 'node:sqlite';
import type { PendingOperation, StorageScope } from './types';

export function listPendingOperations(
	database: DatabaseSync,
	scope: StorageScope
): PendingOperation[] {
	const rows = database.prepare(`SELECT p.account_id, p.workspace_id, p.operation_id,
		v.file_id, v.version_id, v.content_hash, v.content_size, v.blob_path,
		p.status, p.attempts, p.next_retry_at
		FROM pending_operations p JOIN local_versions v
		ON v.account_id = p.account_id AND v.workspace_id = p.workspace_id
		AND v.version_id = p.version_id
		WHERE p.account_id = ? AND p.workspace_id = ? AND p.status != 'synced'
		ORDER BY v.created_at, p.operation_id`).all(scope.accountId, scope.workspaceId) as Array<{
		account_id: string; workspace_id: string; operation_id: string; file_id: string;
		version_id: string; content_hash: string; content_size: number; blob_path: string;
		status: 'pending' | 'uploaded'; attempts: number; next_retry_at: string | null;
	}>;
	return rows.map((row) => ({
		accountId: row.account_id, workspaceId: row.workspace_id, operationId: row.operation_id,
		fileId: row.file_id, versionId: row.version_id, hash: row.content_hash,
		size: row.content_size, blobPath: row.blob_path, status: row.status,
		attempts: row.attempts, nextRetryAt: row.next_retry_at,
	}));
}
