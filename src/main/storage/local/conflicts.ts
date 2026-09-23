import type { DatabaseSync } from 'node:sqlite';
import type { StorageConflict } from '../../../shared/storage_types';
import type { StorageScope } from './types';

export function listStorageConflicts(
	database: DatabaseSync,
	scope: StorageScope
): StorageConflict[] {
	const rows = database.prepare(`SELECT c.file_id, c.version_id, v.path, v.kind
		FROM conflicts c JOIN remote_versions v
		ON v.account_id = c.account_id AND v.workspace_id = c.workspace_id
		AND v.version_id = c.version_id
		WHERE c.account_id = ? AND c.workspace_id = ?
		ORDER BY v.path, c.file_id, c.version_id`).all(
			scope.accountId, scope.workspaceId) as Array<{
			file_id: string; version_id: string; path: string | null;
			kind: StorageConflict['kind'];
		}>;
	return rows.map((row) => ({
		workspaceId: scope.workspaceId,
		fileId: row.file_id,
		versionId: row.version_id,
		path: row.path,
		kind: row.kind,
	}));
}
