import { safeStorage } from 'electron';
import type { StoredProvider } from '../../shared/provider_types';
import type { PersistedProvider } from './providers_types';

export function openProvider({ encryptedApiKey, ...provider }: PersistedProvider): StoredProvider {
	if (!encryptedApiKey) return { ...provider, apiKey: provider.apiKey ?? '' };
	try {
		return {
			...provider,
			apiKey: safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64')),
		};
	} catch {
		return { ...provider, apiKey: '' };
	}
}
