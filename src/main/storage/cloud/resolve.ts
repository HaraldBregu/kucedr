import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { saveLocalSnapshot } from '../local/snapshot';
import type { StorageScope } from '../local/types';

export async function resolveFileConflict(
	database: DatabaseSync,
	scope: StorageScope,
	fileId: string,
	path: string,
	content: Uint8Array,
	deviceId: string
): Promise<string> {
	const heads = database.prepare(`SELECT version_id FROM remote_heads
		WHERE account_id = ? AND workspace_id = ? AND file_id = ?`).all(
			scope.accountId, scope.workspaceId, fileId
		) as Array<{ version_id: string }>;
	const parentIds = [...new Set(heads.map((head) => head.version_id))];
	if (parentIds.length < 2) throw new Error('The file has no unresolved version conflict.');
	const versionId = randomUUID();
	await saveLocalSnapshot(database, {
		...scope, fileId, versionId, operationId: randomUUID(),
		path, parentIds, content, deviceId,
	});
	return versionId;
}
