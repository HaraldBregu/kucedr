import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import { S3Client } from 'npm:@aws-sdk/client-s3@3.1127.0';
import { unseal } from './unseal.ts';

export async function provider(database: SupabaseClient, ownerId: string, providerId: string | null) {
	if (!providerId) {
		const bucket = Deno.env.get('S3_BUCKET');
		const region = Deno.env.get('S3_REGION');
		const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
		const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
		if (!bucket || !region || !accessKeyId || !secretAccessKey)
			throw new Error('Legacy S3 backend is not configured');
		return {
			bucket,
			prefix: Deno.env.get('S3_PREFIX') ?? '',
			client: new S3Client({
				region,
				endpoint: Deno.env.get('S3_ENDPOINT') || undefined,
				forcePathStyle: Deno.env.get('S3_FORCE_PATH_STYLE') === 'true',
				credentials: { accessKeyId, secretAccessKey },
			}),
		};
	}
	const { data, error } = await database.from('storage_provider_connections')
		.select('bucket,region,endpoint,force_path_style,prefix,access_key_ciphertext,secret_key_ciphertext')
		.eq('owner_id', ownerId).eq('provider_id', providerId).single();
	if (error || !data) throw new Error('Storage provider is not registered');
	const [accessKeyId, secretAccessKey] = await Promise.all([
		unseal(data.access_key_ciphertext), unseal(data.secret_key_ciphertext),
	]);
	return {
		bucket: data.bucket as string,
		prefix: data.prefix as string,
		client: new S3Client({
			region: data.region,
			endpoint: data.endpoint || undefined,
			forcePathStyle: data.force_path_style,
			credentials: { accessKeyId, secretAccessKey },
		}),
	};
}
