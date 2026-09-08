import type { StorageProviderInput } from '../../../shared/storage_types';
import { storageProviderIdentifier } from './identifier';

export function normalizeStorageProvider(value: unknown): StorageProviderInput {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid storage provider configuration.');
	}
	const input = value as Record<string, unknown>;
	const fields = { name: 200, endpoint: 2048, region: 128, bucket: 255, accessKeyId: 1024 };
	const values: Record<string, string> = {};
	for (const [field, limit] of Object.entries(fields)) {
		const text = input[field];
		if (typeof text !== 'string' || text.trim().length > limit) {
			throw new Error(`Invalid storage provider ${field}.`);
		}
		values[field] = text.trim();
		if (field !== 'endpoint' && !values[field]) {
			throw new Error(`Storage provider ${field} is required.`);
		}
	}
	if (values.endpoint) {
		let endpoint: URL;
		try {
			endpoint = new URL(values.endpoint);
		} catch {
			throw new Error('Storage endpoint must be a valid HTTP or HTTPS URL.');
		}
		if (
			!['http:', 'https:'].includes(endpoint.protocol) ||
			endpoint.username || endpoint.password || values.endpoint.includes('?') || values.endpoint.includes('#')
		) {
			throw new Error('Storage endpoint must be an HTTP or HTTPS URL without credentials, query, or fragment.');
		}
	}
	if (typeof input.forcePathStyle !== 'boolean') {
		throw new Error('Invalid storage path-style setting.');
	}
	const id = input.id === undefined ? undefined : storageProviderIdentifier(input.id);
	if (input.secretAccessKey !== undefined && (typeof input.secretAccessKey !== 'string' || input.secretAccessKey.length > 16_384)) {
		throw new Error('Invalid storage secret access key.');
	}
	return {
		...(id === undefined ? {} : { id }),
		name: values.name,
		endpoint: values.endpoint,
		region: values.region,
		bucket: values.bucket,
		accessKeyId: values.accessKeyId,
		forcePathStyle: input.forcePathStyle,
		secretAccessKey: (input.secretAccessKey as string | undefined)?.trim(),
	};
}
