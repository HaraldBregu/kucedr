import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { requestError } from './request.mjs';

export async function list(client, bucket, prefix) {
	const objects = [];
	const seen = new Set();
	let continuation;
	for (;;) {
		const response = await client
			.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix,
					...(continuation ? { ContinuationToken: continuation } : {}),
				})
			)
			.catch(requestError);
		for (const object of response.Contents ?? []) {
			if (object.Key) objects.push({ key: object.Key, size: object.Size ?? 0 });
		}
		if (!response.IsTruncated) return objects;
		continuation = response.NextContinuationToken;
		if (!continuation || seen.has(continuation))
			throw new Error('The storage provider returned invalid listing pagination.');
		seen.add(continuation);
	}
}
