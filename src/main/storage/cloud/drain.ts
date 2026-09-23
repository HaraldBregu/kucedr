import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { recordOperationFailure } from '../local/failure';
import { listPendingOperations } from '../local/pending';
import { markOperationPublished } from '../local/published';
import type { StorageScope } from '../local/types';
import { markOperationUploaded } from '../local/uploaded';
import { StorageCloudApi, type PublishRequest } from './api';

export async function drainPending(
	database: DatabaseSync,
	scope: StorageScope,
	cloud: StorageCloudApi,
	expected?: { bucket: string; prefix: string }
): Promise<{ synced: number; failed: number }> {
	let synced = 0;
	let failed = 0;
	for (const operation of listPendingOperations(database, scope)) {
		if (operation.nextRetryAt && Date.parse(operation.nextRetryAt) > Date.now()) continue;
		try {
			const request: PublishRequest = {
				workspaceId: scope.workspaceId,
				operationId: operation.operationId,
				fileId: operation.fileId,
				versionId: operation.versionId,
				kind: operation.kind,
				path: operation.kind === 'tombstone' ? null : operation.path,
				parentIds: operation.parentIds,
				deviceId: operation.deviceId,
			};
			if (operation.kind === 'rename') {
				const parent = await cloud.version(scope.workspaceId, operation.parentIds[0]);
				if (!parent.bucket || !parent.object_key || !parent.sha256 || parent.size_bytes == null) {
					throw new Error('Rename parent content is unavailable.');
				}
				Object.assign(request, {
					bucket: parent.bucket, key: parent.object_key,
					sha256: parent.sha256, sizeBytes: parent.size_bytes,
				});
			} else if (operation.kind !== 'tombstone') {
				if (!operation.blobPath || !operation.hash || operation.size == null) {
					throw new Error('Pending local content is missing.');
				}
				const content = await fs.readFile(operation.blobPath);
				if (content.byteLength !== operation.size ||
					createHash('sha256').update(content).digest('hex') !== operation.hash) {
					throw new Error('Pending local content failed integrity verification.');
				}
				const grant = await cloud.reserveUpload({
					workspaceId: scope.workspaceId, operationId: operation.operationId,
					versionId: operation.versionId, sha256: operation.hash,
					sizeBytes: operation.size,
				});
				if (expected && (grant.bucket !== expected.bucket ||
					(expected.prefix && !grant.key.startsWith(`${expected.prefix.replace(/\/$/, '')}/`)))) {
					throw new Error('Storage backend does not match the saved S3 provider.');
				}
				if (operation.status !== 'uploaded') {
					await cloud.upload(grant, content);
					markOperationUploaded(database, scope, operation.operationId, grant.key);
				}
				Object.assign(request, {
					bucket: grant.bucket, key: grant.key,
					sha256: operation.hash, sizeBytes: operation.size,
				});
			}
			const result = await cloud.publish(request);
			markOperationPublished(database, scope, operation.operationId, String(result.sequence));
			synced += 1;
		} catch {
			recordOperationFailure(database, scope, operation.operationId, 'Cloud publication is pending retry.');
			failed += 1;
		}
	}
	return { synced, failed };
}
