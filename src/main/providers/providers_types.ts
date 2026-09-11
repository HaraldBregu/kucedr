import type { ProviderCredentialKind, StoredProvider } from '../../shared/provider_types';
import type { PersistedStorageProvider } from '../storage/providers/types';

export type ProvidersStoreState = Record<ProviderCredentialKind, StoredProvider[]> & {
	storage: PersistedStorageProvider[];
};
