import type { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { throwStorageRequestError } from './error';

export async function uploadStorageFile(
	client: Pick<S3Client, 'send'>,
	bucket: string,
	key: string,
	filePath: string
): Promise<void> {
	const file = await stat(filePath);
	if (!file.isFile()) throw new Error('The backup source must be a file.');
	const body = createReadStream(filePath);
	try {
		await new Upload({
			client: client as S3Client,
			params: { Bucket: bucket, Key: key, Body: body, ContentLength: file.size },
			partSize: Math.max(8 * 1024 * 1024, Math.ceil(file.size / 10_000)),
			queueSize: 2,
			leavePartsOnError: false,
		}).done();
	} catch (error) {
		throwStorageRequestError(error);
	} finally {
		body.destroy();
	}
}
