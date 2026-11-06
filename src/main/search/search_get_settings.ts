import type { SearchSettings } from '../../shared/search_types';
import { getSearchEngine } from '../agent/agent_store';
import { loadWebSearches } from '../models';
import { pluginSettings } from '../plugins/plugins_settings';

export function getSearchSettings(): SearchSettings {
	const selected = getSearchEngine();
	const services = loadWebSearches();
	const configured: Record<string, boolean> = {};
	for (const service of services) {
		const ready = service.authentication !== 'api-key' || Boolean(pluginSettings(service.provider.id).apiKey?.trim());
		configured[`${service.provider.id}/${service.id}`] = ready;
		configured[service.provider.id] = ready;
	}
	const id = `${selected.providerId}/${selected.serviceId ?? ''}`;
	return { engineId: selected.enabled && services.some((service) => `${service.provider.id}/${service.id}` === id) ? id : null, configured };
}
