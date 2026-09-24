import { SEARCH_ENGINE_IDS, type SearchEngineId, type SearchSettings } from '../../shared/search_types';
import { getSearchEngine, setSearchEngine } from '../agent/agent_store';
import { getSearchSettings } from './search_get_settings';
import { getStoredSearchProviders } from './search_get_providers';
import { setSearchProviders } from './search_store';

export function removeSearchEngine(engineId: SearchEngineId): SearchSettings {
	if (!SEARCH_ENGINE_IDS.includes(engineId)) throw new Error('Unknown search engine.');
	setSearchProviders(getStoredSearchProviders().filter((provider) => provider.id !== engineId));
	if (getSearchEngine().providerId === engineId) {
		setSearchEngine({ providerId: '', providerName: '', enabled: false });
	}
	return getSearchSettings();
}
