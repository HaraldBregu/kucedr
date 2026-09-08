import { S3Client } from '@aws-sdk/client-s3';
import { transferStorage } from '../../../../src/main/storage/s3/transfer';
import type { StoredStorageProvider } from '../../../../src/main/storage/providers/types';

jest.mock('@aws-sdk/client-s3', () => ({
	...jest.requireActual('@aws-sdk/client-s3'),
	S3Client: jest.fn(),
}));

const send = jest.fn();
const destroy = jest.fn();
const provider: StoredStorageProvider = {
	id: 'a00c674a-c8c8-4d01-930f-ad690b3d0123',
	name: 'Archive',
	endpoint: 'https://storage.example.test',
	region: 'auto',
	bucket: 'archive',
	accessKeyId: 'selected-access',
	secretAccessKey: 'selected-secret',
	forcePathStyle: true,
};

beforeEach(() => {
	jest.resetAllMocks();
	(S3Client as jest.Mock).mockImplementation(() => ({ send, destroy }));
	send.mockResolvedValue({});
});

it('captures selected credentials and bucket once for the whole operation', async () => {
	const selected = { ...provider };
	let resume: (() => void) | undefined;
	const paused = new Promise<void>((resolve) => {
		resume = resolve;
	});
	const pending = transferStorage(selected, async (store) => {
		await store.put('one', new Uint8Array());
		await paused;
		await store.put('two', new Uint8Array());
		return 'completed';
	});
	selected.bucket = 'changed';
	selected.secretAccessKey = 'changed-secret';
	resume?.();
	await expect(pending).resolves.toBe('completed');
	expect(S3Client).toHaveBeenCalledTimes(1);
	expect(S3Client).toHaveBeenCalledWith(
		expect.objectContaining({
			endpoint: provider.endpoint,
			region: provider.region,
			forcePathStyle: true,
			credentials: { accessKeyId: provider.accessKeyId, secretAccessKey: provider.secretAccessKey },
		})
	);
	expect(send.mock.calls.map(([command]) => command.input.Bucket)).toEqual(['archive', 'archive']);
	expect(destroy).toHaveBeenCalledTimes(1);
});

it('uses the default AWS endpoint when no endpoint is configured', async () => {
	await transferStorage({ ...provider, endpoint: '', region: 'us-east-1' }, async () => undefined);
	expect((S3Client as jest.Mock).mock.calls[0][0]).not.toHaveProperty('endpoint');
});

it('closes the client after a failed transfer', async () => {
	await expect(
		transferStorage(provider, async () => {
			throw new Error('local file failed');
		})
	).rejects.toThrow('local file failed');
	expect(destroy).toHaveBeenCalledTimes(1);
});
