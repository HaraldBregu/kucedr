jest.mock('electron-store', () =>
	jest.fn().mockImplementation((options: { defaults?: unknown }) => {
		let backing = structuredClone(options.defaults ?? {});
		return {
			get: (key: string) => (backing as Record<string, unknown>)[key],
			set: (key: string, value: unknown) => { (backing as Record<string, unknown>)[key] = value; },
			get store() { return backing; },
			set store(value: unknown) { backing = value; },
		};
	})
);

const mockServices = [
	{
		id: 'custom-search', name: 'Custom Search', type: 'SEARCH_ENGINE',
		url: 'https://search.example/api', authentication: 'api-key',
		provider: { id: 'custom', name: 'Custom' },
		metadata: { search: { method: 'GET', query: 'q', count: 'limit', apiKeyHeader: 'X-Api-Key', apiKeyPrefix: '', resultsPath: ['data', 'items'], descriptionField: 'snippet' } },
	},
	{
		id: 'other-search', name: 'Other Search', type: 'SEARCH_ENGINE',
		url: 'https://other.example/search', authentication: 'api-key',
		provider: { id: 'other', name: 'Other' },
		metadata: { search: { method: 'POST', query: 'query', count: 'max_results', apiKeyHeader: 'Authorization', apiKeyPrefix: 'Bearer ', resultsPath: ['results'], descriptionField: 'content' } },
	},
];
const mockPluginSettings = jest.fn<Record<string, string>, [string]>();
jest.mock('../../../../src/main/models', () => ({ loadWebSearches: () => mockServices }));
jest.mock('../../../../src/main/plugins/plugins_settings', () => ({ pluginSettings: mockPluginSettings }));

import { getSearchWebTools } from '../../../../src/main/agent/tools/web/search_web';
import { getSearchSettings } from '../../../../src/main/search/search_get_settings';
import { selectSearchEngine } from '../../../../src/main/search/search_select_engine';
import { getSearchEngine, setSearchEngine } from '../../../../src/main/agent/agent_store';
import { searchWeb } from '../../../../src/main/search/search_web';

const originalFetch = global.fetch;

beforeEach(() => {
	setSearchEngine({ providerId: '', providerName: '', enabled: false });
	mockPluginSettings.mockReset();
	mockPluginSettings.mockImplementation((id) => id === 'custom' ? { apiKey: 'custom-key' } : {});
	global.fetch = jest.fn();
});

afterAll(() => { global.fetch = originalFetch; });

describe('search service selection', () => {
	it('does not expose the tool until a configured service is selected', () => {
		expect(getSearchSettings().engineId).toBeNull();
		expect(getSearchWebTools()).toEqual([]);
		expect(() => selectSearchEngine('other/other-search')).toThrow();
		expect(() => selectSearchEngine('missing/search')).toThrow();
		selectSearchEngine('custom/custom-search');
		expect(getSearchSettings().engineId).toBe('custom/custom-search');
		expect(getSearchEngine()).toMatchObject({ providerId: 'custom', serviceId: 'custom-search', enabled: true });
		expect(getSearchWebTools().map((item) => item.id)).toEqual(['search_web']);
	});

	it('removes the tool when the selected service is no longer configured', () => {
		selectSearchEngine('custom/custom-search');
		mockPluginSettings.mockReturnValue({});
		expect(getSearchWebTools()).toEqual([]);
	});
});

describe('search service execution', () => {
	it('uses the selected service request metadata and normalizes its response', async () => {
		selectSearchEngine('custom/custom-search');
		(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: { items: [{ title: 'Found', url: 'https://result.example', snippet: 'Text' }] } }) });
		const controller = new AbortController();
		await expect(searchWeb({ query: 'latest', count: 3 }, controller.signal)).resolves.toEqual({
			query: 'latest', results: [{ title: 'Found', url: 'https://result.example', description: 'Text' }],
		});
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [URL | string, RequestInit];
		expect(String(url)).toBe('https://search.example/api?q=latest&limit=3');
		expect(init.headers).toEqual(expect.objectContaining({ 'X-Api-Key': 'custom-key' }));
		expect(init.signal).toBe(controller.signal);
	});

	it('executes a different service using its own POST metadata', async () => {
		mockPluginSettings.mockImplementation((id) => id === 'other' ? { apiKey: 'other-key' } : {});
		selectSearchEngine('other/other-search');
		(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [{ title: 'Found', url: 'https://result.example', content: 'Text' }] }) });
		await expect(searchWeb({ query: 'latest', count: 2 })).resolves.toEqual({
			query: 'latest', results: [{ title: 'Found', url: 'https://result.example', description: 'Text' }],
		});
		expect(global.fetch).toHaveBeenCalledWith('https://other.example/search', expect.objectContaining({
			method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer other-key' }),
			body: JSON.stringify({ query: 'latest', max_results: 2 }),
		}));
	});
});
