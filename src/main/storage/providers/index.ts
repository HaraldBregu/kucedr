import path from 'node:path';
import Store from 'electron-store';
import { userDataLocation } from '../../shared/user_data_location';
import { restrictSettingsFile } from '../../shared/restrict_settings_file';
import { StorageProviderStore } from './store';
import type { StorageProvidersState } from './types';

const store = new Store<StorageProvidersState>({
	name: 'storage',
	cwd: path.resolve(userDataLocation(), 'settings'),
	accessPropertiesByDotNotation: false,
	defaults: { encryptedProviders: '' },
});

restrictSettingsFile(store.path);

export const storageProviders = new StorageProviderStore(store);
