import type { StoredProvider } from '../../shared/provider_types';
import { getSearchEngines, providersStorePath, setSearchEngines } from '../providers/providers_index';

export const searchStorePath = providersStorePath;

export function getSearchProviders(): StoredProvider[] {
	return getSearchEngines().filter(isStoredProvider);
}

export function setSearchProviders(providers: StoredProvider[]): void {
	setSearchEngines(providers.filter(isStoredProvider));
}

function isStoredProvider(value: unknown): value is StoredProvider {
	if (typeof value !== 'object' || value === null) return false;
	const provider = value as Partial<StoredProvider>;
	return (
		typeof provider.id === 'string' &&
		typeof provider.name === 'string' &&
		typeof provider.apiKey === 'string' &&
		typeof provider.baseUrl === 'string'
	);
}
