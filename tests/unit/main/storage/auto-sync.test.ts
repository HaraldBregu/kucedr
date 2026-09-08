import { isAutoSyncable, runStorageSync } from '../../../../src/main/storage/storage_auto_sync';

it('only schedules backups with a selected provider and enabled folders', () => {
	const storage = { providerId: 'connection', paths: ['/data/agent'], syncEnabled: true, syncCronExpression: '0 3 * * *' };
	expect(isAutoSyncable(storage)).toBe(true);
	expect(isAutoSyncable({ ...storage, providerId: undefined })).toBe(false);
	expect(isAutoSyncable({ ...storage, paths: [] })).toBe(false);
	expect(isAutoSyncable({ ...storage, syncEnabled: false })).toBe(false);
});

it('starts scheduled backups through the shared operation service', async () => {
	const logger = { info: jest.fn(), error: jest.fn() };
	const operations = {
		backup: jest.fn().mockReturnValue({
			operationId: 'scheduled-1',
			trigger: 'scheduled',
		}),
		wait: jest.fn().mockResolvedValue({
			state: 'succeeded',
			transferred: 3,
			failed: 0,
		}),
	};

	await runStorageSync(logger, operations as never);

	expect(operations.backup).toHaveBeenCalledWith('scheduled');
	expect(operations.wait).toHaveBeenCalledWith('scheduled-1');
	expect(logger.info).toHaveBeenCalledWith('Storage', 'Auto sync uploaded 3 file(s)');
});

it('skips a schedule tick when a manual backup is already running', async () => {
	const logger = { info: jest.fn(), error: jest.fn() };
	const operations = {
		backup: jest.fn().mockReturnValue({ operationId: 'manual-1', trigger: 'manual' }),
		wait: jest.fn(),
	};

	await runStorageSync(logger, operations as never);

	expect(operations.wait).not.toHaveBeenCalled();
	expect(logger.info).toHaveBeenCalledWith('Storage', 'Auto sync skipped; backup already running');
});

it('logs a failed background operation as an error', async () => {
	const logger = { info: jest.fn(), error: jest.fn() };
	const operations = {
		backup: jest.fn().mockReturnValue({
			operationId: 'scheduled-1',
			trigger: 'scheduled',
		}),
		wait: jest.fn().mockResolvedValue({
			state: 'failed',
			transferred: 0,
			failed: 0,
			error: 'offline',
		}),
	};

	await runStorageSync(logger, operations as never);

	expect(logger.info).not.toHaveBeenCalled();
	expect(logger.error).toHaveBeenCalledWith(
		'Storage',
		'Auto sync failed',
		expect.objectContaining({ message: 'offline' })
	);
});
