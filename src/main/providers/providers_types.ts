import type { ProviderCredentialKind, StoredProvider } from '../../shared/provider_types';

export type ProvidersStoreState = Record<ProviderCredentialKind, StoredProvider[]> & {
	storage: string;
};
