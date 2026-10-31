import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { requestError } from './request.mjs';

export async function download(client, bucket, key, file) {
	const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key })).catch(requestError);
	if (!response.Body) throw new Error('The storage response did not contain a file.');
	await pipeline(response.Body, createWriteStream(file, { flags: 'wx', mode: 0o600 })).catch(requestError);
}
