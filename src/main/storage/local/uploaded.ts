import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export function markOperationUploaded(
	database: DatabaseSync,
	scope: StorageScope,
	operationId: string,
	objectKey: string,
	uploadedBytes: number
): void {
	const result = database.prepare(`UPDATE pending_operations
		SET status = 'uploaded', object_key = ?, uploaded_bytes = ?, last_error = NULL
		WHERE account_id = ? AND workspace_id = ? AND operation_id = ? AND status != 'synced'`)
		.run(objectKey, uploadedBytes, scope.accountId, scope.workspaceId, operationId);
	if (result.changes !== 1) throw new Error('Unknown pending storage operation.');
}
