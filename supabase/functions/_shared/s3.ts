import { S3Client } from 'npm:@aws-sdk/client-s3@3.1127.0';

export function s3() {
	const region = Deno.env.get('S3_REGION');
	const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID');
	const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY');
	if (!region || !accessKeyId || !secretAccessKey) throw new Error('S3 backend is not configured');
	const endpoint = Deno.env.get('S3_ENDPOINT') || undefined;
	const forcePathStyle = Deno.env.get('S3_FORCE_PATH_STYLE') === 'true';
	return new S3Client({ region, endpoint, forcePathStyle,
		credentials: { accessKeyId, secretAccessKey } });
}
