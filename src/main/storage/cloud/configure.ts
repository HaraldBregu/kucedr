import { randomUUID } from 'node:crypto';
import type { StorageSyncSettings } from '../../../shared/storage_types';
import { storageProviders } from '../providers';
import { readStorageConfig } from '../local/config';
import { writeStorageConfig } from '../local/config_write';
import type { StorageConfig } from '../local/types';
import { openStorageState } from '../local/state';

export async function configureVersionedStorage(
	settings: StorageSyncSettings,
	supabaseUrl: string,
	enabled?: boolean
): Promise<StorageConfig> {
	if (!settings.providerId) throw new Error('Select a saved S3 storage provider.');
	const provider = storageProviders.list().find((entry) => entry.id === settings.providerId);
	if (!provider) throw new Error('The saved S3 storage provider was not found.');
	const existing = await readStorageConfig();
	if (existing && (existing.supabase.url !== supabaseUrl ||
		(existing.providerId === provider.id && (existing.s3.bucket !== provider.bucket ||
			existing.s3.region !== provider.region)))) {
		throw new Error('Cloud sync configuration differs from the saved provider or account project.');
	}
	if (existing && existing.providerId !== provider.id) {
		const database = openStorageState();
		try {
			if (database.prepare("SELECT 1 FROM pending_operations WHERE status <> 'synced' LIMIT 1").get()) {
				throw new Error('Publish pending file versions before changing the storage provider.');
			}
		} finally {
			database.close();
		}
	}
	const config: StorageConfig = {
		version: 1,
		provider: 's3',
		providerId: provider.id,
		s3: { bucket: provider.bucket, region: provider.region, prefix: existing?.s3.prefix ?? '' },
		supabase: { url: supabaseUrl },
		sync: { enabled: enabled ?? existing?.sync.enabled ?? false,
			maxCacheBytes: existing?.sync.maxCacheBytes ?? 1_073_741_824 },
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
