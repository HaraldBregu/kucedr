import {
	SEARCH_ENGINE_IDS,
	type SearchEngineId,
	type SearchEngineInput,
	type SearchSettings,
} from '../../shared/search_types';
import { getSearchSettings } from './search_get_settings';
import { SEARCH_PROVIDERS } from './catalog';
import { getSearchProviders, setSearchProviders } from './search_store';

export function saveSearchEngine(
	engineId: SearchEngineId,
	input: SearchEngineInput
): SearchSettings {
	if (!SEARCH_ENGINE_IDS.includes(engineId)) throw new Error('Unknown search engine.');
	const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
	if (!apiKey) throw new Error('A search engine API key is required.');

	const catalogProvider = SEARCH_PROVIDERS.find((provider) => provider.id === engineId);
	if (!catalogProvider) throw new Error('Unknown search engine.');
	const providersById = new Map(
		getSearchProviders().map((provider) => [provider.id, provider])
	);
	providersById.set(engineId, { ...catalogProvider, apiKey });
	const providers = SEARCH_PROVIDERS.flatMap((provider) => {
		const stored = providersById.get(provider.id);
		if (!stored) return [];
		return [{ ...provider, apiKey: stored.apiKey }];
	});
	setSearchProviders(providers);

	return getSearchSettings();
}
