import type { SearchEngineId } from '../../shared/search_types';
import { getStoredSearchProviders } from './search_get_providers';

export function getSearchKey(engineId: SearchEngineId): string | undefined {
	const storedKey =
		getStoredSearchProviders().find((provider) => provider.id === engineId)?.apiKey.trim() ?? '';
	if (storedKey) return storedKey;

	const environmentKey =
		engineId === 'brave' ? process.env.BRAVE_API_KEY : process.env.TAVILY_API_KEY;
	return environmentKey?.trim() || undefined;
}
