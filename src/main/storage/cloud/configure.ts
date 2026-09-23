import { randomUUID } from 'node:crypto';
import type { StorageSyncSettings } from '../../../shared/storage_types';
import { storageProviders } from '../providers';
import { readStorageConfig } from '../local/config';
import { writeStorageConfig } from '../local/config_write';
import type { StorageConfig } from '../local/types';

export async function configureVersionedStorage(
	settings: StorageSyncSettings,
	supabaseUrl: string
): Promise<StorageConfig> {
	if (!settings.providerId) throw new Error('Select a saved S3 storage provider.');
	const provider = storageProviders.list().find((entry) => entry.id === settings.providerId);
	if (!provider) throw new Error('The saved S3 storage provider was not found.');
	const existing = await readStorageConfig();
	if (existing && (existing.providerId !== provider.id || existing.s3.bucket !== provider.bucket ||
		existing.s3.region !== provider.region || existing.supabase.url !== supabaseUrl)) {
		throw new Error('Cloud sync configuration differs from the saved provider or account project.');
	}
	const config: StorageConfig = {
		version: 1,
		provider: 's3',
		providerId: provider.id,
		s3: { bucket: provider.bucket, region: provider.region, prefix: existing?.s3.prefix ?? '' },
		supabase: { url: supabaseUrl },
		sync: { enabled: settings.syncEnabled, maxCacheBytes: existing?.sync.maxCacheBytes ?? 1_073_741_824 },
		workspaces: existing?.workspaces ?? [],
	};
	for (const rootPath of settings.paths) {
		if (!config.workspaces.some((entry) => entry.rootPath === rootPath)) {
			config.workspaces.push({ id: randomUUID(), rootPath });
		}
	}
	await writeStorageConfig(config);
	return config;
}
