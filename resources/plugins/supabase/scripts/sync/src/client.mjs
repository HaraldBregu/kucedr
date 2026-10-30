import { S3Client } from '@aws-sdk/client-s3';

export function createClient(provider) {
	return new S3Client({
		region: provider.region,
		...(provider.endpoint ? { endpoint: provider.endpoint } : {}),
		forcePathStyle: provider.forcePathStyle,
		credentials: { accessKeyId: provider.accessKeyId, secretAccessKey: provider.secretAccessKey },
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
	});
}
