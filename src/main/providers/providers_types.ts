import type {
	EnabledPluginProviders,
	ProviderCredentialKind,
	StoredProvider,
} from '../../shared/provider_types';
import type { PersistedStorageProvider } from '../storage/providers/types';

export type PersistedProvider = Omit<StoredProvider, 'apiKey'> & {
	apiKey?: string;
	encryptedApiKey?: string;
};

export type ProvidersStoreState = Record<ProviderCredentialKind, PersistedProvider[]> & {
	storage: PersistedStorageProvider[];
	enabledPlugins: EnabledPluginProviders;
};
