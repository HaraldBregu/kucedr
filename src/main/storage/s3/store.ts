import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type { StorageObjectInfo } from '../../../shared/storage_types';
import type { StorageObjectStore } from '../remote';
import { STORAGE_MAX_OBJECT_BYTES } from '../limits';
import { throwStorageRequestError } from './error';

export class S3ObjectStore implements StorageObjectStore {
	constructor(private readonly client: Pick<S3Client, 'send'>, private readonly bucket: string) {}

	async get(key: string): Promise<Uint8Array> {
		const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.key(key) })).catch(throwStorageRequestError);
		const body = response.Body as Readable | undefined;
		if (!body) throw new Error('The storage response did not contain a file.');
		if ((response.ContentLength ?? 0) > STORAGE_MAX_OBJECT_BYTES) {
			body.destroy();
			throw new Error('Cloud restore files must be no larger than 50 MiB.');
		}
		const chunks: Uint8Array[] = [];
		let size = 0;
		for await (const chunk of body) {
			const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk as Uint8Array;
			size += bytes.byteLength;
			if (size > STORAGE_MAX_OBJECT_BYTES) throw new Error('Cloud restore files must be no larger than 50 MiB.');
			chunks.push(bytes);
		}
		return Buffer.concat(chunks, size);
	}

	async list(prefix = ''): Promise<StorageObjectInfo[]> {
		if (prefix) this.key(prefix.replace(/\/+$/, ''));
		const objects: StorageObjectInfo[] = [];
		let continuation: string | undefined;
		const seen = new Set<string>();
		for (;;) {
			const response = await this.client.send(new ListObjectsV2Command({
				Bucket: this.bucket,
				Prefix: prefix,
				...(continuation ? { ContinuationToken: continuation } : {}),
			})).catch(throwStorageRequestError);
			for (const object of response.Contents ?? []) {
				if (!object.Key) continue;
				objects.push({ key: object.Key, size: object.Size ?? 0, lastModified: object.LastModified?.toISOString() });
			}
			if (!response.IsTruncated) return objects;
			continuation = response.NextContinuationToken;
			if (!continuation || seen.has(continuation)) throw new Error('The storage provider returned invalid listing pagination.');
			seen.add(continuation);
		}
	}

	async put(key: string, data: Uint8Array, contentType?: string): Promise<void> {
		if (data.byteLength > STORAGE_MAX_OBJECT_BYTES) throw new Error('Cloud backup files must be no larger than 50 MiB.');
		await this.client.send(new PutObjectCommand({
			Bucket: this.bucket, Key: this.key(key), Body: data,
			...(contentType ? { ContentType: contentType } : {}),
		})).catch(throwStorageRequestError);
	}

	private key(key: string): string {
		if (!key || key.startsWith('/') || key.includes('\\') || key.split('/').some((part) => !part || part === '.' || part === '..')) {
			throw new Error('Cloud backup object key is invalid.');
		}
		return key;
	}
}
