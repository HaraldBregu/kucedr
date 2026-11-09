import { createHash } from 'node:crypto';
import { loadStorageServices } from '../models';
import { pluginSettings } from '../plugins/plugins_settings';

export interface BackupTarget {
	/** Stable UUID for the service and bucket; version sync registers it with the backend. */
	id: string;
	name: string;
	protocol: 's3';
	endpoint: string;
	region: string;
	bucket: string;
	forcePathStyle: boolean;
	accessKeyId: string;
	secretAccessKey: string;
}

/** Resolves a `<plugin>/<service>` STORAGE service to the S3 connection its plugin settings hold. */
export function resolveBackupService(serviceId: unknown): BackupTarget {
	if (typeof serviceId !== 'string' || !serviceId) {
		throw new Error('Select a storage service for backup.');
	}
	const service = loadStorageServices().find(
		(entry) => `${entry.provider.id}/${entry.id}` === serviceId
	);
	if (!service) throw new Error('The selected storage service was not found.');
	const values = pluginSettings(service.provider.id);
	const [bucket, region, accessKeyId, secretAccessKey, endpoint] = [
		'bucket',
		'region',
		'accessKeyId',
		'secretAccessKey',
		'endpoint',
	].map((key) => values[key]?.trim() ?? '');
	if (!bucket || !region || !accessKeyId || !secretAccessKey) {
		throw new Error('Configure this storage service before selecting it.');
	}
	if (/[/\\?#\s]/.test(bucket)) throw new Error('Storage bucket must be a bucket name, without a path.');
	if (endpoint) {
		let url: URL;
		try {
			url = new URL(endpoint);
		} catch {
			throw new Error('Storage endpoint must be a valid HTTP or HTTPS URL.');
		}
		if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
			throw new Error('Storage endpoint must be an HTTP or HTTPS URL without credentials, query, or fragment.');
		}
	}
	const hex = createHash('sha256')
		.update([serviceId, endpoint, region, bucket].join('\n'))
		.digest('hex');
	const variant = (8 | (parseInt(hex[16], 16) & 3)).toString(16);
	return {
		id: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
		name: service.name,
		protocol: 's3',
		endpoint,
		region,
		bucket,
		forcePathStyle: values.forcePathStyle?.trim().toLowerCase() === 'true',
		accessKeyId,
		secretAccessKey,
	};
}
