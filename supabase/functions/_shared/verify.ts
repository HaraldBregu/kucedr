import { GetObjectCommand } from 'npm:@aws-sdk/client-s3@3.1127.0';
import type { S3Client } from 'npm:@aws-sdk/client-s3@3.1127.0';

export async function verify(
	client: S3Client,
	bucket: string,
	key: string,
	expectedHash: string,
	expectedSize: number
) {
	const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	if (!response.Body || response.ContentLength !== expectedSize)
		throw new Error('Uploaded object size mismatch');
	const bytes = await response.Body.transformToByteArray();
	if (bytes.byteLength !== expectedSize) throw new Error('Uploaded object size mismatch');
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
	const hash = Array.from(digest, (part) => part.toString(16).padStart(2, '0')).join('');
	if (hash !== expectedHash) throw new Error('Uploaded object checksum mismatch');
}
