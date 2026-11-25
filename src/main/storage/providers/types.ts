import type { StorageProvider } from '../../../shared/storage_types';

export type StoredStorageProvider = Omit<StorageProvider, 'hasSecretAccessKey' | 'hasPassphrase'> & {
	secretAccessKey: string;
	passphrase?: string;
};

export type PersistedStorageProvider = Omit<
	StoredStorageProvider,
	'secretAccessKey' | 'passphrase'
> & {
	encryptedSecretAccessKey: string;
	encryptedPassphrase?: string;
};

export interface StorageProvidersState {
	storage: PersistedStorageProvider[];
}
