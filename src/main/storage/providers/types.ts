import type { StorageProvider } from '../../../shared/storage_types';

export type StoredStorageProvider = Omit<StorageProvider, 'hasSecretAccessKey'> & {
	secretAccessKey: string;
};

export type PersistedStorageProvider = Omit<StoredStorageProvider, 'secretAccessKey'> & {
	encryptedSecretAccessKey: string;
};

export interface StorageProvidersState {
	storage: PersistedStorageProvider[];
}
