import type { StorageProvider } from '../../../shared/storage_types';

export type StoredStorageProvider = Omit<StorageProvider, 'hasSecretAccessKey'> & {
	secretAccessKey: string;
};

export interface StorageProvidersState {
	storageProviders: string;
}
