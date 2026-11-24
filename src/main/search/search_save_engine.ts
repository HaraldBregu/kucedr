import type { SearchEngineId, SearchEngineInput, SearchSettings } from '../../shared/search_types';
import { loadWebSearches } from '../models';
import { pluginSettings } from '../plugins/plugins_settings';
import { savePluginSettings } from '../plugins/plugins_save_settings';
import { getSearchSettings } from './search_get_settings';

export function saveSearchEngine(engineId: SearchEngineId, input: SearchEngineInput): SearchSettings {
	const service = loadWebSearches().find((entry) => entry.provider.id === engineId);
	if (!service) throw new Error('Unknown search service.');
	const entered = typeof input?.apiKey === 'string' ? input.apiKey.trim() : '';
	if (entered) savePluginSettings(service.provider.id, { apiKey: entered });
	else if (!pluginSettings(service.provider.id).apiKey?.trim())
		throw new Error('A search engine API key is required.');
	return getSearchSettings();
}
