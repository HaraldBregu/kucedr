import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { StorageScope } from './types';

export function updateLocalFilePath(
	database: DatabaseSync,
	scope: StorageScope,
	fileId: string,
	relativePath: string
): void {
	const normalized = path.posix.normalize(relativePath.split(path.sep).join('/'));
	if (!normalized || normalized === '.' || normalized === '..' ||
		normalized.startsWith('../') || path.posix.isAbsolute(normalized)) {
		throw new Error('Invalid relative storage path.');
	}
	const result = database.prepare(`UPDATE local_files SET relative_path = ?
		WHERE account_id = ? AND workspace_id = ? AND file_id = ?`)
		.run(normalized, scope.accountId, scope.workspaceId, fileId);
	if (result.changes !== 1) throw new Error('Unknown local file.');
}
