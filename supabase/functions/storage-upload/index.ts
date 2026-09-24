import { PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.1127.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.1127.0';
import { authenticate } from '../_shared/auth.ts';
import { json } from '../_shared/json.ts';
import { provider } from '../_shared/provider.ts';

Deno.serve(async (request) => {
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	try {
		const { ownerId, database } = await authenticate(request);
		const body = await request.json();
		const { providerId, workspaceId, operationId, versionId, sha256, sizeBytes } = body;
		if (
			typeof providerId !== 'string' ||
			typeof workspaceId !== 'string' ||
			typeof operationId !== 'string' ||
			typeof versionId !== 'string' ||
			typeof sha256 !== 'string' ||
			!/^[0-9a-f]{64}$/.test(sha256) ||
			!Number.isSafeInteger(sizeBytes) ||
			sizeBytes < 0 ||
			sizeBytes > 52428800
		) {
			return json({ error: 'Invalid upload request' }, 400);
		}
		const prior = await database.from('storage_uploads')
			.select('provider_id').eq('workspace_id', workspaceId)
			.eq('owner_id', ownerId).eq('operation_id', operationId).maybeSingle();
		if (prior.error) throw prior.error;
		if (prior.data && prior.data.provider_id !== providerId &&
			!(prior.data.provider_id === null && providerId === Deno.env.get('S3_PROVIDER_ID')))
			throw new Error('Upload provider does not match reservation');
		const resolvedId = prior.data?.provider_id === null ? null : providerId;
		const storage = await provider(database, ownerId, resolvedId);
		const { bucket, prefix } = storage;
		const { data, error } = await database.rpc('storage_reserve_upload', {
			p_owner_id: ownerId,
			p_workspace_id: workspaceId,
			p_operation_id: operationId,
			p_version_id: versionId,
			p_bucket: bucket,
			p_prefix: prefix,
			p_sha256: sha256,
			p_size_bytes: sizeBytes,
			p_provider_id: resolvedId,
		});
		if (error) throw error;
		const reservation = data?.[0];
		if (!reservation) throw new Error('Upload reservation failed');
		const headers = { 'if-none-match': '*' };
		const uploadUrl = await getSignedUrl(
			storage.client,
			new PutObjectCommand({
				Bucket: bucket,
				Key: reservation.object_key,
				IfNoneMatch: '*',
			}),
			{ expiresIn: 600 }
		);
		return json({
			bucket,
			key: reservation.object_key,
			uploadUrl,
			headers,
			verified: reservation.verified,
		});
	} catch {
		return json({ error: 'Upload request failed' }, 400);
	}
});
