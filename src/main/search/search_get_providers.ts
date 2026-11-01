import type { StoredProvider } from '../../shared/provider_types';
import { getSearchProviders } from './search_store';
import { SEARCH_PROVIDERS } from './catalog';
import { pluginSettings } from '../plugins/plugins_settings';

export function getStoredSearchProviders(): StoredProvider[] {
	const stored = getSearchProviders() as unknown;
	if (!Array.isArray(stored)) return [];
	const providers = stored.filter(
		(value): value is StoredProvider =>
			typeof value === 'object' &&
			value !== null &&
			typeof value.id === 'string' &&
			typeof value.name === 'string' &&
			typeof value.apiKey === 'string' &&
			typeof value.baseUrl === 'string'
	);
	for (const catalog of SEARCH_PROVIDERS) {
		const apiKey = pluginSettings(catalog.id).apiKey;
		if (!apiKey) continue;
		const index = providers.findIndex((provider) => provider.id === catalog.id);
		const provider = { ...catalog, apiKey };
		if (index < 0) providers.push(provider);
		else providers[index] = provider;
	}
	return providers;
}
