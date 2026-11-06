import type { SearchEngineId, SearchSettings } from '../../shared/search_types';
import { getSearchEngine, setSearchEngine } from '../agent/agent_store';
import { loadWebSearches } from '../models';
import { pluginSettings } from '../plugins/plugins_settings';
import { savePluginSettings } from '../plugins/plugins_save_settings';
import { getSearchSettings } from './search_get_settings';

export function removeSearchEngine(engineId: SearchEngineId): SearchSettings {
	if (!loadWebSearches().some((entry) => entry.provider.id === engineId)) throw new Error('Unknown search service.');
	const settings = pluginSettings(engineId);
	delete settings.apiKey;
	savePluginSettings(engineId, settings);
	if (getSearchEngine().providerId === engineId) setSearchEngine({ providerId: '', providerName: '', enabled: false });
	return getSearchSettings();
}
