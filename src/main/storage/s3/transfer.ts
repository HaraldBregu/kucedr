import { S3Client } from '@aws-sdk/client-s3';
import type { StoredStorageProvider } from '../providers/types';
import type { StorageObjectStore } from '../remote';
import { S3ObjectStore } from './store';

export async function transferStorage<T>(
	provider: StoredStorageProvider,
	transfer: (store: StorageObjectStore) => Promise<T>
): Promise<T> {
	const client = new S3Client({
		region: provider.region,
		...(provider.endpoint ? { endpoint: provider.endpoint } : {}),
		forcePathStyle: provider.forcePathStyle,
		credentials: { accessKeyId: provider.accessKeyId, secretAccessKey: provider.secretAccessKey },
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
	});
	try {
		return await transfer(new S3ObjectStore(client, provider.bucket));
	} finally {
		client.destroy();
	}
}
