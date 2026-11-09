import { Upload } from '@aws-sdk/lib-storage';
import { createReadStream, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { requestError } from './request.mjs';

export async function upload(client, bucket, source, key) {
	const staging = await fs.mkdtemp(path.join(tmpdir(), 'kucedr-upload-'));
	const file = path.join(staging, 'file');
	try {
		const original = await fs.lstat(source);
		if (!original.isFile() || original.isSymbolicLink()) throw new Error('Upload source is not a regular file.');
		await fs.copyFile(source, file);
		const { size } = await fs.stat(file);
		const body = createReadStream(file);
		try {
			await new Upload({
				client,
				params: { Bucket: bucket, Key: key, Body: body, ContentLength: size },
				partSize: Math.max(8 * 1024 * 1024, Math.ceil(size / 10_000)),
				queueSize: 2,
				leavePartsOnError: false,
			}).done();
		} catch (error) {
			requestError(error);
		} finally {
			body.destroy();
		}
	} finally {
		await fs.rm(staging, { recursive: true, force: true });
	}
}
