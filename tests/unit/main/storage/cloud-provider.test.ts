import type { SupabaseClient } from '@supabase/supabase-js';
import { StorageCloudApi } from '../../../../src/main/storage/cloud/api';
import type { StoredStorageProvider } from '../../../../src/main/storage/providers/types';

it('registers the selected S3-compatible endpoint and credentials through the authenticated backend', async () => {
	const invoke = jest.fn().mockResolvedValue({ data: { ok: true }, error: null });
	const cloud = new StorageCloudApi({ functions: { invoke } } as unknown as SupabaseClient);
	const provider: StoredStorageProvider = {
		id: 'a00c674a-c8c8-4d01-930f-ad690b3d0123',
		name: 'Other S3',
		bucket: 'archive-bucket',
		region: 'custom-1',
		endpoint: 'https://objects.example.test',
		forcePathStyle: true,
		accessKeyId: 'access-key',
		secretAccessKey: 'private-key',
	};
	await cloud.registerProvider(provider);
	expect(invoke).toHaveBeenCalledWith('storage-provider', {
		body: JSON.stringify({
			providerId: provider.id,
			bucket: provider.bucket,
			region: provider.region,
			endpoint: provider.endpoint,
			forcePathStyle: true,
			accessKeyId: provider.accessKeyId,
			secretAccessKey: provider.secretAccessKey,
		}),
		headers: { 'Content-Type': 'application/json' },
	});
});
