import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { throwStorageRequestError } from './error';

export async function downloadStorageFile(
	client: Pick<S3Client, 'send'>,
	bucket: string,
	key: string,
	filePath: string
): Promise<void> {
	const response = await client
		.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
		.catch(throwStorageRequestError);
	const body = response.Body as Readable | undefined;
	if (!body) throw new Error('The storage response did not contain a file.');
	await pipeline(body, createWriteStream(filePath, { flags: 'wx', mode: 0o600 })).catch(
		throwStorageRequestError
	);
}
