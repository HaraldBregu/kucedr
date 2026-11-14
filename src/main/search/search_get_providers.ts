import type { StoredProvider } from '../../shared/provider_types';
import { getSearchProviders } from './search_store';
import { loadWebSearches } from '../models';
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
	for (const service of loadWebSearches()) {
		const apiKey = pluginSettings(service.provider.id).apiKey;
		if (!apiKey) continue;
		const index = providers.findIndex((provider) => provider.id === service.provider.id);
		const provider = { id: service.provider.id, name: service.provider.name, baseUrl: service.url, apiKey };
		if (index < 0) providers.push(provider);
		else providers[index] = provider;
	}
	return providers.map((provider) => ({ ...provider, apiKey: provider.apiKey ? MASKED_KEY : '' }));
}
