import type { StorageProvider } from '../../../shared/storage_types';
import type { StoredStorageProvider } from './types';

export function storageProviderSummary(provider: StoredStorageProvider): StorageProvider {
	const { secretAccessKey, ...metadata } = provider;
	return { ...metadata, hasSecretAccessKey: Boolean(secretAccessKey) };
}
