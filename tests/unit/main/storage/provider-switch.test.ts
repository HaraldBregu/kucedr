import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configureVersionedStorage } from '../../../../src/main/storage/cloud/configure';
import { storageProviders } from '../../../../src/main/storage/providers';
import { saveLocalSnapshot } from '../../../../src/main/storage/local/snapshot';
import { openStorageState } from '../../../../src/main/storage/local/state';

it('changes the selected history provider only after pending local versions are published', async () => {
	const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-provider-switch-'));
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	const first = 'a00c674a-c8c8-4d01-930f-ad690b3d0123';
	const second = 'b00c674a-c8c8-4d01-930f-ad690b3d0123';
	const providers = [first, second].map((id, index) => ({
		id, name: `Provider ${index}`, bucket: `bucket-${index}`, region: 'us-east-1',
		endpoint: '', forcePathStyle: false, accessKeyId: 'key', hasSecretAccessKey: true,
	}));
	const list = jest.spyOn(storageProviders, 'list').mockReturnValue(providers);
	try {
		const folder = path.join(root, 'working');
		const settings = { paths: [folder], syncEnabled: true, syncCronExpression: '', providerId: first };
		const config = await configureVersionedStorage(settings, 'https://project.supabase.co', true);
		const database = openStorageState();
		try {
			await saveLocalSnapshot(database, {
				accountId: 'account-a', workspaceId: config.workspaces[0].id,
				fileId: 'file-a', versionId: 'version-a', operationId: 'operation-a',
				path: 'note.txt', parentIds: [], content: Buffer.from('pending edit'), deviceId: 'device-a',
			});
			await expect(configureVersionedStorage({ ...settings, providerId: second },
				'https://project.supabase.co')).rejects.toThrow('Publish pending file versions');
			database.prepare("UPDATE pending_operations SET status = 'synced'").run();
			const switched = await configureVersionedStorage({ ...settings, providerId: second },
				'https://project.supabase.co');
			expect(switched.providerId).toBe(second);
			expect(switched.workspaces).toEqual(config.workspaces);
		} finally {
			database.close();
		}
	} finally {
		list.mockRestore();
		if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
		rmSync(root, { recursive: true, force: true });
	}
});
