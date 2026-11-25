import type { StorageProvider } from '../../../shared/storage_types';
import type { StoredStorageProvider } from './types';

export function storageProviderSummary(provider: StoredStorageProvider): StorageProvider {
	const { secretAccessKey, passphrase, ...metadata } = provider;
	return {
		...metadata,
		hasSecretAccessKey: Boolean(secretAccessKey),
		hasPassphrase: Boolean(passphrase),
	};
}
