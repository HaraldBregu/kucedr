import cron, { type ScheduledTask } from 'node-cron';
import { isAutoSyncable, runStorageSync } from './run';
import { getStorageSettings } from './store';
import type { StorageSyncLogger } from './types';
import type { StorageOperations } from './operations';

let task: ScheduledTask | undefined;
let syncLogger: StorageSyncLogger | undefined;
let syncOperations: StorageOperations | undefined;

export function startStorageSync(logger: StorageSyncLogger, operations: StorageOperations): void {
	syncLogger = logger;
	syncOperations = operations;
	scheduleAll();
}

export function stopStorageSync(): void {
	task?.destroy();
	task = undefined;
	syncLogger = undefined;
	syncOperations = undefined;
}

export function rescheduleStorageSync(): void {
	if (syncLogger) scheduleAll();
}

export function nextStorageSync(): string | undefined {
	return task?.getNextRun()?.toISOString();
}

function scheduleAll(): void {
	task?.destroy();
	task = undefined;
	const logger = syncLogger;
	const operations = syncOperations;
	if (!logger || !operations) return;
	const storage = getStorageSettings();
	if (!isAutoSyncable(storage)) return;
	if (!cron.validate(storage.syncCronExpression)) {
		logger.error('Storage', 'Invalid sync schedule');
		return;
	}
	logger.info('Storage', `Auto sync scheduled with ${storage.syncCronExpression}`);
	task = cron.schedule(
		storage.syncCronExpression,
		async () => {
			await runStorageSync(logger, operations);
		},
		{ noOverlap: true }
	);
}
