import { safeStorage } from 'electron';
import type { StoredProvider } from '../../shared/provider_types';
import { isSafeStorageAvailable } from '../shared/safe_storage';
import { openProvider } from './open';
import type { PersistedProvider } from './providers_types';

export function sealProvider(provider: StoredProvider, saved?: PersistedProvider): PersistedProvider {
	const { apiKey, ...metadata } = provider;
	if (!apiKey) {
		const unreadable = saved?.encryptedApiKey && !openProvider(saved).apiKey;
		return { ...metadata, encryptedApiKey: unreadable ? saved.encryptedApiKey : '' };
	}
	if (isSafeStorageAvailable()) {
		return { ...metadata, encryptedApiKey: safeStorage.encryptString(apiKey).toString('base64') };
	}
	if (saved?.apiKey === apiKey) return provider;
	throw new Error('Secure storage is unavailable.');
}
