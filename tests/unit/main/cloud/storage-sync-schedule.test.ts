const schedule = jest.fn();
const validate = jest.fn();
const destroy = jest.fn();
const getStorageSettings = jest.fn();
const isAutoSyncable = jest.fn();
const runStorageSync = jest.fn();

jest.mock('node-cron', () => ({
	__esModule: true,
	default: { schedule, validate },
}));

jest.mock('../../../../src/main/storage/storage_store', () => ({
	getStorageSettings,
}));

jest.mock('../../../../src/main/storage/storage_auto_sync', () => ({
	isAutoSyncable,
	runStorageSync,
}));

import {
	rescheduleStorageSync,
	startStorageSync,
	stopStorageSync,
} from '../../../../src/main/storage/storage_sync_schedule';

describe('storage sync scheduling', () => {
	const logger = { info: jest.fn(), error: jest.fn() };
	const operations = {} as never;
	const storage = {
		providerId: 'connection',
		paths: ['/data/agent'],
		syncEnabled: true,
		syncCronExpression: '0 3 * * *',
	};

	beforeEach(() => {
		stopStorageSync();
		schedule.mockClear();
		validate.mockClear();
		destroy.mockClear();
		getStorageSettings.mockClear();
		isAutoSyncable.mockClear();
		runStorageSync.mockClear();
		logger.info.mockClear();
		logger.error.mockClear();
		schedule.mockReturnValue({ destroy });
		validate.mockReturnValue(true);
		getStorageSettings.mockReturnValue(storage);
		isAutoSyncable.mockReturnValue(true);
		runStorageSync.mockResolvedValue(undefined);
	});

	afterEach(() => stopStorageSync());

	it('schedules selected storage without an account dependency and prevents overlapping sync', async () => {
		startStorageSync(logger, operations);

		expect(schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function), {
			noOverlap: true,
		});
		await schedule.mock.calls[0][1]();
		expect(runStorageSync).toHaveBeenCalledWith(logger, operations);
	});

	it('destroys prior tasks when storage settings change', () => {
		startStorageSync(logger, operations);
		rescheduleStorageSync();

		expect(destroy).toHaveBeenCalledTimes(1);
		expect(schedule).toHaveBeenCalledTimes(2);
	});

	it('does not schedule an invalid cron expression', () => {
		validate.mockReturnValue(false);
		startStorageSync(logger, operations);

		expect(schedule).not.toHaveBeenCalled();
		expect(logger.error).toHaveBeenCalledWith('Storage', 'Invalid sync schedule');
	});
});
