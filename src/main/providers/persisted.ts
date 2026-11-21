import type { PersistedProvider } from './providers_types';

export function persistedProviders(value: unknown): PersistedProvider[] {
	if (!Array.isArray(value)) return [];
	return value.filter((entry): entry is PersistedProvider => {
		if (typeof entry !== 'object' || entry === null) return false;
		const provider = entry as Partial<PersistedProvider>;
		return (
			typeof provider.id === 'string' &&
			typeof provider.name === 'string' &&
			typeof provider.baseUrl === 'string' &&
			(typeof provider.apiKey === 'string' || typeof provider.encryptedApiKey === 'string')
		);
	});
}
