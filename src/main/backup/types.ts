export const DEFAULT_SYNC_CRON_EXPRESSION = '0 3 * * *';

export interface StorageSyncLogger {
	info(source: string, message: string, data?: unknown): void;
	error(source: string, message: string, data?: unknown): void;
}
