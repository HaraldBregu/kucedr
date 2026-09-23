import path from 'node:path';
import type { StorageConfig } from './types';

export function normalizeStorageConfig(value: StorageConfig): StorageConfig {
	if (value.version !== 1 || value.provider !== 's3' || !value.s3 ||
		!value.supabase || !value.sync || !Array.isArray(value.workspaces)) {
		throw new Error('Invalid storage configuration.');
	}
	const { bucket, region, prefix } = value.s3;
	if (typeof bucket !== 'string' || !/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket) ||
		typeof region !== 'string' || !/^[a-z0-9-]{2,32}$/.test(region) ||
		typeof prefix !== 'string' || prefix.startsWith('/') || prefix.includes('..') ||
		prefix.length > 512) {
		throw new Error('Invalid S3 storage configuration.');
	}
	const url = new URL(value.supabase.url);
	if (url.protocol !== 'https:' &&
		!(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
		throw new Error('Invalid Supabase project URL.');
	}
	if (url.username || url.password || url.search || url.hash) {
		throw new Error('Supabase project URL cannot contain credentials.');
	}
	if (typeof value.sync.enabled !== 'boolean' ||
		!Number.isSafeInteger(value.sync.maxCacheBytes) || value.sync.maxCacheBytes < 0) {
		throw new Error('Invalid storage sync settings.');
	}
	const workspaces = value.workspaces.map((workspace) => {
		if (typeof workspace.id !== 'string' ||
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspace.id) ||
			typeof workspace.rootPath !== 'string' || !path.isAbsolute(workspace.rootPath)) {
			throw new Error('Invalid storage workspace.');
		}
		return { id: workspace.id, rootPath: path.resolve(workspace.rootPath) };
	});
	return {
		version: 1,
		provider: 's3',
		s3: { bucket, region, prefix },
		supabase: { url: url.origin },
		sync: { enabled: value.sync.enabled, maxCacheBytes: value.sync.maxCacheBytes },
		workspaces,
	};
}
