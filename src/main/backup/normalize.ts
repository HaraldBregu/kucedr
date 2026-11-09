import cron from 'node-cron';
import type { StorageSyncSettings } from '../../shared/storage_types';
import { normalizeStoragePaths } from '../storage/storage_paths';

export function normalizeStorageSettings(value: unknown): StorageSyncSettings {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid storage sync settings.');
	}
	const input = value as Partial<StorageSyncSettings>;
	const syncCronExpression =
		typeof input.syncCronExpression === 'string'
			? input.syncCronExpression.trim().replace(/\s+/g, ' ')
			: '';
	if (typeof input.syncEnabled !== 'boolean') throw new Error('Invalid sync setting.');
	if (!cron.validate(syncCronExpression)) {
		throw new Error('Storage sync schedule must be a valid cron expression.');
	}
	const serviceId = typeof input.serviceId === 'string' ? input.serviceId.trim() : '';
	return {
		...(serviceId ? { serviceId } : {}),
		paths: normalizeStoragePaths(input.paths),
		syncEnabled: input.syncEnabled,
		syncCronExpression,
	};
}
