import { z } from 'zod';
import type { SearchRequest, SearchResponse } from '../../shared/search_types';
import { loadWebSearches } from '../models';
import { pluginSettings } from '../plugins/plugins_settings';
import { getSearchSettings } from './search_get_settings';

const searchContract = z.object({
	method: z.enum(['GET', 'POST']),
	query: z.string().min(1),
	count: z.string().min(1),
	apiKeyHeader: z.string().min(1),
	apiKeyPrefix: z.string(),
	resultsPath: z.array(z.string().min(1)).min(1),
	descriptionField: z.string().min(1),
});

export async function searchWeb(request: SearchRequest, signal?: AbortSignal): Promise<SearchResponse> {
	const { engineId, configured } = getSearchSettings();
	if (!engineId || !configured[engineId]) {
		throw new Error('Select a configured search service in Settings > Agent before using search_web.');
	}
	const service = loadWebSearches().find((entry) => `${entry.provider.id}/${entry.id}` === engineId);
	if (!service) throw new Error('The selected search service is unavailable.');
	const contract = searchContract.safeParse((service.metadata as unknown as Record<string, unknown> | undefined)?.search);
	if (!contract.success) throw new Error(`Search service ${service.name} has no valid search request configuration.`);
	const apiKey = pluginSettings(service.provider.id).apiKey?.trim();
	if (!apiKey) throw new Error(`Configure ${service.provider.name} before using search_web.`);

	const { method, query, count, apiKeyHeader, apiKeyPrefix, resultsPath, descriptionField } = contract.data;
	const url = new URL(service.url);
	const parameters = { [query]: request.query, [count]: request.count ?? 5 };
	const headers: Record<string, string> = { Accept: 'application/json', [apiKeyHeader]: `${apiKeyPrefix}${apiKey}` };
	let body: string | undefined;
	if (method === 'GET') {
		for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
	} else {
		headers['Content-Type'] = 'application/json';
		body = JSON.stringify(parameters);
	}
	const timeout = AbortSignal.timeout(TIMEOUT_MS);
	const response = await fetch(url, { method, headers, body, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
	if (!response.ok) throw new Error(`${service.name} search failed (${response.status}): ${response.statusText}`);
	let results: unknown = JSON.parse(await responseText(response, MAX_RESPONSE_BYTES));
	for (const key of resultsPath) {
		results = typeof results === 'object' && results !== null ? (results as Record<string, unknown>)[key] : undefined;
	}
	if (!Array.isArray(results)) throw new Error(`${service.name} returned an invalid search response.`);
	return {
		query: request.query,
		results: results.map((item: unknown) => {
			const entry = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {};
			return {
				title: typeof entry.title === 'string' ? entry.title : '',
				url: typeof entry.url === 'string' ? entry.url : '',
				description: typeof entry[descriptionField] === 'string' ? entry[descriptionField] as string : '',
			};
		}),
	};
}
