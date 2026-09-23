import { GetObjectCommand } from 'npm:@aws-sdk/client-s3@3.1127.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.1127.0';
import { authenticate } from '../_shared/auth.ts';
import { json } from '../_shared/json.ts';
import { s3 } from '../_shared/s3.ts';

Deno.serve(async (request) => {
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	try {
		const { ownerId, database } = await authenticate(request);
		const { workspaceId, versionId } = await request.json();
		const { data, error } = await database
			.from('storage_versions')
			.select('bucket,object_key,sha256,size_bytes')
			.eq('workspace_id', workspaceId)
			.eq('id', versionId)
			.eq('owner_id', ownerId)
			.single();
		if (error || !data?.bucket || !data.object_key) throw new Error('Version is unavailable');
		const url = await getSignedUrl(
			s3(),
			new GetObjectCommand({
				Bucket: data.bucket,
				Key: data.object_key,
			}),
			{ expiresIn: 600 }
		);
		return json({ url, sha256: data.sha256, sizeBytes: data.size_bytes });
	} catch {
		return json({ error: 'Download failed' }, 400);
	}
});
