import type { SearchEngineId, SearchEngineInput, SearchSettings } from '../../shared/search_types';
import { loadWebSearches } from '../models';
import { pluginSettings } from '../plugins/plugins_settings';
import { savePluginSettings } from '../plugins/plugins_save_settings';
import { getSearchSettings } from './search_get_settings';
import { MASKED_KEY } from './search_get_providers';

export function saveSearchEngine(engineId: SearchEngineId, input: SearchEngineInput): SearchSettings {
	const service = loadWebSearches().find((entry) => entry.provider.id === engineId);
	if (!service) throw new Error('Unknown search service.');
	const settings = pluginSettings(service.provider.id);
	const entered = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
	const apiKey = entered === MASKED_KEY ? settings.apiKey?.trim() : entered;
	if (!apiKey) throw new Error('A search engine API key is required.');
	savePluginSettings(service.provider.id, { ...settings, apiKey });
	return getSearchSettings();
}
