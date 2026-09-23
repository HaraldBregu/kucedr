import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export function getSyncCursor(database: DatabaseSync, scope: StorageScope): string {
	const row = database.prepare(`SELECT cursor FROM sync_cursors
		WHERE account_id = ? AND workspace_id = ?`).get(scope.accountId, scope.workspaceId) as
		| { cursor: string }
		| undefined;
	return row?.cursor ?? '0';
}
