import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export function getOrCreateFileId(
	database: DatabaseSync,
	scope: StorageScope,
	relativePath: string
): string {
	const normalized = path.posix.normalize(relativePath.split(path.sep).join('/'));
	if (!normalized || normalized === '.' || normalized === '..' ||
		normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
		throw new Error('Invalid relative storage path.');
	}
	const values = [scope.accountId, scope.workspaceId, normalized];
	const existing = database.prepare(`SELECT file_id FROM local_files
		WHERE account_id = ? AND workspace_id = ? AND relative_path = ?`).get(...values) as
		| { file_id: string }
		| undefined;
	if (existing) return existing.file_id;
	database.prepare(`INSERT OR IGNORE INTO local_files
		(account_id, workspace_id, file_id, relative_path) VALUES (?, ?, ?, ?)`)
		.run(scope.accountId, scope.workspaceId, randomUUID(), normalized);
	return (database.prepare(`SELECT file_id FROM local_files
		WHERE account_id = ? AND workspace_id = ? AND relative_path = ?`).get(...values) as
		{ file_id: string }).file_id;
}
