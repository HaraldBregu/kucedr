import { PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.1127.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.1127.0';
import { authenticate } from '../_shared/auth.ts';
import { json } from '../_shared/json.ts';
import { s3 } from '../_shared/s3.ts';

Deno.serve(async (request) => {
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	try {
		const { ownerId, database } = await authenticate(request);
		const body = await request.json();
		const { workspaceId, operationId, versionId, sha256, sizeBytes } = body;
		const bucket = Deno.env.get('S3_BUCKET');
		if (
			!bucket ||
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
		const { data, error } = await database.rpc('storage_reserve_upload', {
			p_owner_id: ownerId,
			p_workspace_id: workspaceId,
			p_operation_id: operationId,
			p_version_id: versionId,
			p_bucket: bucket,
			p_sha256: sha256,
			p_size_bytes: sizeBytes,
		});
		if (error) throw error;
		const reservation = data?.[0];
		if (!reservation) throw new Error('Upload reservation failed');
		const digest = new Uint8Array(
			sha256.match(/../g).map((part: string) => Number.parseInt(part, 16))
		);
		const checksum = btoa(String.fromCharCode(...digest));
		const headers = { 'if-none-match': '*', 'x-amz-checksum-sha256': checksum };
		const uploadUrl = await getSignedUrl(
			s3(),
			new PutObjectCommand({
				Bucket: bucket,
				Key: reservation.object_key,
				IfNoneMatch: '*',
				ChecksumSHA256: checksum,
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
