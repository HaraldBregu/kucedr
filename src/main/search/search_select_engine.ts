import type { SearchEngineId, SearchSettings } from '../../shared/search_types';
import { setSearchEngine } from '../agent/agent_store';
import { loadWebSearches } from '../models';
import { getSearchSettings } from './search_get_settings';

export function selectSearchEngine(engineId: SearchEngineId): SearchSettings {
	const service = loadWebSearches().find((entry) => `${entry.provider.id}/${entry.id}` === engineId);
	if (!service) throw new Error('Unknown search service.');
	if (!getSearchSettings().configured[engineId]) throw new Error('Configure this search service before selecting it.');
	setSearchEngine({ providerId: service.provider.id, providerName: service.provider.name, serviceId: service.id, enabled: true });
	return getSearchSettings();
}
