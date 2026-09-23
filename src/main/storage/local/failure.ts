import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export function recordOperationFailure(
	database: DatabaseSync,
	scope: StorageScope,
	operationId: string,
	_message: string
): void {
	const row = database.prepare(`SELECT attempts FROM pending_operations WHERE
		account_id = ? AND workspace_id = ? AND operation_id = ? AND status != 'synced'`)
		.get(scope.accountId, scope.workspaceId, operationId) as { attempts: number } | undefined;
	if (!row) throw new Error('Unknown pending storage operation.');
	const delay = Math.min(60 * 60, 2 ** Math.min(row.attempts, 10));
	database.prepare(`UPDATE pending_operations SET attempts = attempts + 1,
		next_retry_at = ?, last_error = ?
		WHERE account_id = ? AND workspace_id = ? AND operation_id = ?`)
		.run(new Date(Date.now() + delay * 1000).toISOString(),
			'Storage upload or publication failed.', scope.accountId, scope.workspaceId, operationId);
}
