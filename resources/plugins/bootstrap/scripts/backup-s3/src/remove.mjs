import { DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { requestError } from './request.mjs';

export async function remove(client, bucket, keys) {
	for (let index = 0; index < keys.length; index += 1000) {
		const response = await client
			.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: { Objects: keys.slice(index, index + 1000).map((Key) => ({ Key })), Quiet: true },
				})
			)
			.catch(requestError);
		if (response.Errors?.length) throw new Error(`Could not delete ${response.Errors.length} stored file(s).`);
	}
}
