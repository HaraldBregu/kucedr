import type { StorageSyncSettings } from '../../shared/storage_types';
import type { StorageOperations } from './storage_operations';
import type { StorageSyncLogger } from './storage_sync_types';

export function isAutoSyncable(storage: StorageSyncSettings): boolean {
	return Boolean(storage.providerId) && storage.paths.length > 0 && storage.syncEnabled;
}

export async function runStorageSync(
	logger: StorageSyncLogger,
	operations: StorageOperations
): Promise<void> {
	try {
		const started = operations.backup('scheduled');
		if (started.trigger !== 'scheduled') {
			logger.info('Storage', 'Auto sync skipped; backup already running');
			return;
		}
		const result = await operations.wait(started.operationId);
		if (!result) throw new Error('Storage operation status was lost.');
		if (result.state === 'failed') {
			logger.error(
				'Storage',
				'Auto sync failed',
				new Error(result.error ?? 'Cloud backup failed.')
			);
			return;
		}
		const failedSuffix = result.failed ? `, ${result.failed} failed` : '';
		logger.info('Storage', `Auto sync uploaded ${result.transferred} file(s)${failedSuffix}`);
	} catch (error) {
		logger.error('Storage', 'Auto sync failed', error);
	}
}
