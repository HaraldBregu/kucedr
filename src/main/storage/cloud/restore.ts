import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { installVerifiedDownload } from '../local/install';
import { saveLocalSnapshot } from '../local/snapshot';
import type { StorageScope } from '../local/types';
import { StorageCloudApi } from './api';

export async function restoreHistoricalVersion(
	database: DatabaseSync,
	scope: StorageScope,
	cloud: StorageCloudApi,
	versionId: string,
	deviceId: string
): Promise<string> {
	const version = await cloud.version(scope.workspaceId, versionId);
	if (!version.path || !version.sha256 || version.size_bytes == null) {
		throw new Error('Historical version has no restorable content.');
	}
	const content = await cloud.download(scope.workspaceId, versionId);
	if (content.byteLength !== version.size_bytes) throw new Error('Historical content size mismatch.');
	await installVerifiedDownload(scope, content, version.sha256);
	const local = database.prepare(`SELECT version_id FROM local_heads
		WHERE account_id = ? AND workspace_id = ? AND file_id = ?`).all(
			scope.accountId, scope.workspaceId, version.file_id
		) as Array<{ version_id: string }>;
	const remote = await cloud.heads(scope.workspaceId, version.file_id);
	const parentIds = [...new Set([...local.map((item) => item.version_id), ...remote])];
	const restoredId = randomUUID();
	await saveLocalSnapshot(database, {
		...scope, fileId: version.file_id, versionId: restoredId,
		operationId: randomUUID(), path: version.path,
		parentIds, content, deviceId, kind: 'restore',
	});
	return restoredId;
}
