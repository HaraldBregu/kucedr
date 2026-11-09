import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { configureVersionedStorage } from '../../../../src/main/storage/cloud/configure';
import { saveLocalSnapshot } from '../../../../src/main/storage/local/snapshot';
import { openStorageState } from '../../../../src/main/storage/local/state';

const first = 'a00c674a-c8c8-4d01-930f-ad690b3d0123';
const second = 'b00c674a-c8c8-4d01-930f-ad690b3d0123';

jest.mock('../../../../src/main/backup/resolve', () => ({
	resolveBackupService: (serviceId: string) => {
		const index = serviceId === 's3/first' ? 0 : 1;
		return {
			id: [first, second][index],
			name: `Service ${index}`,
			protocol: 's3',
			bucket: `bucket-${index}`,
			region: 'us-east-1',
			endpoint: '',
			forcePathStyle: false,
			accessKeyId: 'key',
			secretAccessKey: 'secret',
		};
	},
}));

it('changes the selected history provider only after pending local versions are published', async () => {
	const previousRoot = process.env.KUCEDR_E2E_DATA_ROOT;
	const root = mkdtempSync(path.join(os.tmpdir(), 'kucedr-provider-switch-'));
	process.env.KUCEDR_E2E_DATA_ROOT = root;
	try {
		const folder = path.join(root, 'working');
		const settings = { paths: [folder], syncEnabled: true, syncCronExpression: '', serviceId: 's3/first' };
		const config = await configureVersionedStorage(settings, 'https://project.supabase.co', true);
		const database = openStorageState();
		try {
			await saveLocalSnapshot(database, {
				accountId: 'account-a', workspaceId: config.workspaces[0].id,
				fileId: 'file-a', versionId: 'version-a', operationId: 'operation-a',
				path: 'note.txt', parentIds: [], content: Buffer.from('pending edit'), deviceId: 'device-a',
			});
			await expect(configureVersionedStorage({ ...settings, serviceId: 's3/second' },
				'https://project.supabase.co')).rejects.toThrow('Publish pending file versions');
			database.prepare("UPDATE pending_operations SET status = 'synced'").run();
			const switched = await configureVersionedStorage({ ...settings, serviceId: 's3/second' },
				'https://project.supabase.co');
			expect(switched.providerId).toBe(second);
			expect(switched.workspaces).toEqual(config.workspaces);
		} finally {
			database.close();
		}
	} finally {
		if (previousRoot === undefined) delete process.env.KUCEDR_E2E_DATA_ROOT;
		else process.env.KUCEDR_E2E_DATA_ROOT = previousRoot;
		rmSync(root, { recursive: true, force: true });
	}
});
