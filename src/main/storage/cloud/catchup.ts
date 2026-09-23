import type { DatabaseSync } from 'node:sqlite';
import { applyRemoteChange } from '../local/change';
import { getSyncCursor } from '../local/cursor';
import { installVerifiedDownload } from '../local/install';
import type { StorageScope } from '../local/types';
import { StorageCloudApi } from './api';

export async function catchUp(
	database: DatabaseSync,
	scope: StorageScope,
	cloud: StorageCloudApi
): Promise<number> {
	let count = 0;
	for (;;) {
		const cursor = getSyncCursor(database, scope);
		const changes = await cloud.changes(scope.workspaceId, cursor);
		if (changes.length === 0) return count;
		for (const change of changes) {
			const version = await cloud.version(scope.workspaceId, change.version_id);
			const [parentIds, heads] = await Promise.all([
				cloud.parents(scope.workspaceId, change.version_id),
				cloud.heads(scope.workspaceId, change.file_id),
			]);
			if (version.kind !== 'tombstone') {
				if (!version.sha256 || version.size_bytes == null) {
					throw new Error('Cloud version has incomplete content metadata.');
				}
				const content = await cloud.download(scope.workspaceId, change.version_id);
				if (content.byteLength !== version.size_bytes) {
					throw new Error('Cloud download size mismatch.');
				}
				await installVerifiedDownload(scope, content, version.sha256);
			}
			applyRemoteChange(database, scope, {
				sequence: String(change.sequence), versionId: change.version_id,
				fileId: change.file_id, path: version.path, kind: version.kind,
				hash: version.sha256, size: version.size_bytes,
				bucket: version.bucket, key: version.object_key,
				parentIds, heads,
		});
			count += 1;
		}
		if (changes.length < 100) return count;
	}
}
