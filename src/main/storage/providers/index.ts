import { providersStore } from '../../providers/providers_store';
import { StorageProviderStore } from './store';

export const storageProviders = new StorageProviderStore(providersStore);
