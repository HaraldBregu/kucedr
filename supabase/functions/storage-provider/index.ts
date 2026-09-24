import { authenticate } from '../_shared/auth.ts';
import { endpoint } from '../_shared/endpoint.ts';
import { json } from '../_shared/json.ts';
import { validPrefix } from '../_shared/prefix.ts';
import { seal } from '../_shared/seal.ts';

Deno.serve(async (request) => {
	if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
	try {
		const { ownerId, database } = await authenticate(request);
		const { providerId, bucket, region, endpoint: rawEndpoint, forcePathStyle, prefix = '',
			accessKeyId, secretAccessKey } = await request.json();
		if (typeof providerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerId) ||
			typeof bucket !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/.test(bucket) ||
			typeof region !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(region) ||
			typeof forcePathStyle !== 'boolean' ||
			!validPrefix(prefix) ||
			typeof accessKeyId !== 'string' || !accessKeyId || accessKeyId.length > 4096 ||
			typeof secretAccessKey !== 'string' || !secretAccessKey || secretAccessKey.length > 16384) {
			return json({ error: 'Invalid storage provider' }, 400);
		}
		const targetEndpoint = endpoint(rawEndpoint);
		const [accessCiphertext, secretCiphertext] = await Promise.all([
			seal(accessKeyId), seal(secretAccessKey),
		]);
		const { error } = await database.from('storage_provider_connections').upsert({
			owner_id: ownerId,
			provider_id: providerId,
			bucket,
			region,
			endpoint: targetEndpoint,
			force_path_style: forcePathStyle,
			prefix,
			access_key_ciphertext: accessCiphertext,
			secret_key_ciphertext: secretCiphertext,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'owner_id,provider_id' });
		if (error) throw error;
		return json({ ok: true });
	} catch {
		return json({ error: 'Provider registration failed' }, 400);
	}
});
