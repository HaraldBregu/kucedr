import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export interface RemoteChange {
	sequence: string;
	versionId: string;
	fileId: string;
	path: string | null;
	kind: 'content' | 'rename' | 'tombstone' | 'restore';
	hash: string | null;
	size: number | null;
	bucket: string | null;
	key: string | null;
	parentIds: string[];
	heads: string[];
}

export function applyRemoteChange(
	database: DatabaseSync,
	scope: StorageScope,
	change: RemoteChange
): void {
	const current = database.prepare(`SELECT cursor FROM sync_cursors
		WHERE account_id = ? AND workspace_id = ?`).get(scope.accountId, scope.workspaceId) as
		| { cursor: string }
		| undefined;
	const cursor = BigInt(current?.cursor ?? '0');
	const sequence = BigInt(change.sequence);
	if (sequence <= cursor) return;
	if (sequence !== cursor + 1n) throw new Error('Storage changes must be applied in order.');
	database.exec('BEGIN IMMEDIATE');
	try {
		database.prepare(`INSERT INTO remote_versions
			(account_id, workspace_id, version_id, file_id, path, kind, content_hash,
			 content_size, bucket, object_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(account_id, workspace_id, version_id) DO NOTHING`)
			.run(scope.accountId, scope.workspaceId, change.versionId, change.fileId,
				change.path, change.kind, change.hash, change.size, change.bucket, change.key);
		const parent = database.prepare(`INSERT OR IGNORE INTO remote_parents
			(account_id, workspace_id, version_id, parent_id) VALUES (?, ?, ?, ?)`);
		for (const parentId of new Set(change.parentIds)) {
			parent.run(scope.accountId, scope.workspaceId, change.versionId, parentId);
		}
		const removeParent = database.prepare(`DELETE FROM remote_heads WHERE account_id = ?
			AND workspace_id = ? AND file_id = ? AND version_id = ?`);
		for (const parentId of change.parentIds) {
			removeParent.run(scope.accountId, scope.workspaceId, change.fileId, parentId);
		}
		const head = database.prepare(`INSERT INTO remote_heads
			(account_id, workspace_id, file_id, version_id) VALUES (?, ?, ?, ?)`);
		head.run(scope.accountId, scope.workspaceId, change.fileId, change.versionId);
		database.prepare(`DELETE FROM conflicts WHERE account_id = ? AND workspace_id = ?`)
			.run(scope.accountId, scope.workspaceId);
		database.prepare(`INSERT INTO conflicts (account_id, workspace_id, file_id, version_id)
			SELECT h.account_id, h.workspace_id, h.file_id, h.version_id
			FROM remote_heads h JOIN remote_versions v
			ON v.account_id = h.account_id AND v.workspace_id = h.workspace_id
			AND v.version_id = h.version_id
			WHERE h.account_id = ? AND h.workspace_id = ? AND (
				(SELECT count(*) FROM remote_heads h2 WHERE h2.account_id = h.account_id
				 AND h2.workspace_id = h.workspace_id AND h2.file_id = h.file_id) > 1
				OR (v.path IS NOT NULL AND EXISTS (
				 SELECT 1 FROM remote_heads other_head JOIN remote_versions other_version
				 ON other_version.account_id = other_head.account_id
				 AND other_version.workspace_id = other_head.workspace_id
				 AND other_version.version_id = other_head.version_id
				 WHERE other_head.account_id = h.account_id
				 AND other_head.workspace_id = h.workspace_id
				 AND other_head.file_id != h.file_id AND other_version.path = v.path
				))
			)`).run(scope.accountId, scope.workspaceId);
		database.prepare(`INSERT INTO sync_cursors (account_id, workspace_id, cursor)
			VALUES (?, ?, ?) ON CONFLICT(account_id, workspace_id) DO UPDATE SET cursor = excluded.cursor`)
			.run(scope.accountId, scope.workspaceId, change.sequence);
		database.exec('COMMIT');
	} catch (error) {
		database.exec('ROLLBACK');
		throw error;
	}
}
