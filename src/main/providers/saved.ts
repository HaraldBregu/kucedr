import type { SavedProvider, StoredProvider } from '../../shared/provider_types';

export function savedProvider({ id, name, baseUrl, apiKey }: StoredProvider): SavedProvider {
	return { id, name, baseUrl, saved: Boolean(apiKey) };
}
