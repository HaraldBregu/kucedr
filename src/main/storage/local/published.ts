import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export function markOperationPublished(
	database: DatabaseSync,
	scope: StorageScope,
	operationId: string,
	remoteChangeId: string
): void {
	const result = database.prepare(`UPDATE pending_operations SET status = 'synced',
		remote_change_id = ?, last_error = NULL, next_retry_at = NULL
		WHERE account_id = ? AND workspace_id = ? AND operation_id = ?`)
		.run(remoteChangeId, scope.accountId, scope.workspaceId, operationId);
	if (result.changes !== 1) throw new Error('Unknown local storage operation.');
}
