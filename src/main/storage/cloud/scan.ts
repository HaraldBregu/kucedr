import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { STORAGE_MAX_OBJECT_BYTES } from '../limits';
import { getOrCreateFileId } from '../local/file';
import { saveLocalSnapshot } from '../local/snapshot';
import type { StorageScope } from '../local/types';
import { walkFiles } from '../storage_walk';

export async function scanWorkspace(
	database: DatabaseSync,
	scope: StorageScope,
	root: string,
	deviceId: string
): Promise<string[]> {
	const rootStat = await fs.lstat(root);
	if (rootStat.isSymbolicLink()) throw new Error('A symbolic link cannot be synchronized.');
	const files = rootStat.isDirectory() ? await walkFiles(root) : [root];
	const saved: string[] = [];
	const seen = new Set<string>();
	for (const file of files) {
		const relative = rootStat.isDirectory()
			? path.relative(root, file).split(path.sep).join('/') : path.basename(file);
		const fileId = getOrCreateFileId(database, scope, relative);
		seen.add(fileId);
		const content = await fs.readFile(file);
		if (content.byteLength > STORAGE_MAX_OBJECT_BYTES) {
			throw new Error('Cloud sync files must be no larger than 50 MiB.');
		}
		const hash = createHash('sha256').update(content).digest('hex');
		const latest = database.prepare(`SELECT content_hash FROM local_versions
			WHERE account_id = ? AND workspace_id = ? AND file_id = ?
			ORDER BY rowid DESC LIMIT 1`).get(scope.accountId, scope.workspaceId, fileId) as
			| { content_hash: string | null } | undefined;
		if (latest?.content_hash === hash) {
			database.prepare(`INSERT INTO working_files
				(account_id, workspace_id, file_id, relative_path, content_hash)
				VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, workspace_id, file_id)
				DO UPDATE SET relative_path = excluded.relative_path,
				content_hash = excluded.content_hash`).run(
					scope.accountId, scope.workspaceId, fileId, relative, hash);
			continue;
		}
		const parents = database.prepare(`SELECT version_id FROM local_heads
			WHERE account_id = ? AND workspace_id = ? AND file_id = ?`).all(
				scope.accountId, scope.workspaceId, fileId
			) as Array<{ version_id: string }>;
		await saveLocalSnapshot(database, {
			...scope, fileId, versionId: randomUUID(), operationId: randomUUID(),
			path: relative, parentIds: parents.map((item) => item.version_id),
			content, deviceId,
		});
		saved.push(file);
		database.prepare(`INSERT INTO working_files
			(account_id, workspace_id, file_id, relative_path, content_hash)
			VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id, workspace_id, file_id)
			DO UPDATE SET relative_path = excluded.relative_path,
			content_hash = excluded.content_hash`).run(
				scope.accountId, scope.workspaceId, fileId, relative, hash);
	}
	const tracked = database.prepare(`SELECT file_id, relative_path FROM working_files
		WHERE account_id = ? AND workspace_id = ?`).all(
			scope.accountId, scope.workspaceId) as Array<{ file_id: string; relative_path: string }>;
	for (const entry of tracked) {
		if (seen.has(entry.file_id)) continue;
		const parents = database.prepare(`SELECT version_id FROM local_heads
			WHERE account_id = ? AND workspace_id = ? AND file_id = ?`).all(
				scope.accountId, scope.workspaceId, entry.file_id
			) as Array<{ version_id: string }>;
		if (parents.length) {
			await saveLocalSnapshot(database, {
				...scope, fileId: entry.file_id, versionId: randomUUID(), operationId: randomUUID(),
				path: entry.relative_path, parentIds: parents.map((item) => item.version_id),
				deviceId, kind: 'tombstone',
			});
		}
		database.prepare(`DELETE FROM working_files WHERE account_id = ?
			AND workspace_id = ? AND file_id = ?`).run(
				scope.accountId, scope.workspaceId, entry.file_id);
	}
	return saved;
}
