jest.mock('electron-store', () =>
	jest.fn().mockImplementation((options: { defaults?: unknown }) => {
		let backing = structuredClone(options.defaults ?? {});
		return {
			get(key: string) {
				return (backing as Record<string, unknown>)[key];
			},
			set(key: string, value: unknown) {
				(backing as Record<string, unknown>)[key] = value;
			},
			get store() {
				return backing;
			},
			set store(value: unknown) {
				backing = value;
			},
		};
	})
);

import { getSearchWebTools } from '../../../../src/main/agent/tools/web/search_web';
import { searchBrave } from '../../../../src/main/search/adapters/brave';
import { searchTavily } from '../../../../src/main/search/adapters/tavily';
import { getSearchKey } from '../../../../src/main/search/search_get_key';
import { getSearchSettings } from '../../../../src/main/search/search_get_settings';
import { saveSearchEngine } from '../../../../src/main/search/search_save_engine';
import { removeSearchEngine } from '../../../../src/main/search/search_remove_engine';
import { selectSearchEngine } from '../../../../src/main/search/search_select_engine';
import { getSearchProviders, setSearchProviders } from '../../../../src/main/search/search_store';
import { getSearchEngine, setSearchEngine } from '../../../../src/main/agent/agent_store';
import { searchWeb } from '../../../../src/main/search/search_web';

const originalFetch = global.fetch;

function response(body: unknown, status = 200, statusText = 'OK'): Response {
	return {
		ok: status >= 200 && status < 300,
		status,
		statusText,
		json: jest.fn().mockResolvedValue(body),
	} as unknown as Response;
}

beforeEach(() => {
	setSearchProviders([]);
	setSearchEngine({ providerId: '', providerName: '', enabled: false });
	delete process.env.BRAVE_API_KEY;
	delete process.env.TAVILY_API_KEY;
	global.fetch = jest.fn();
});

afterAll(() => {
	global.fetch = originalFetch;
});

describe('search settings', () => {
	it('stores providers independently and preserves explicit selection', () => {
		expect(getSearchSettings()).toEqual({
			engineId: null,
			configured: { brave: false, tavily: false },
		});

		expect(saveSearchEngine('tavily', { apiKey: ' tavily-key ' })).toEqual({
			engineId: null,
			configured: { brave: false, tavily: true },
		});
		expect(selectSearchEngine('tavily').engineId).toBe('tavily');
		saveSearchEngine('brave', { apiKey: 'brave-key' });
		expect(getSearchProviders()).toEqual([
			{
				id: 'brave',
				name: 'Brave',
				baseUrl: 'https://api.search.brave.com/res/v1/web/search',
				apiKey: 'brave-key',
			},
			{
				id: 'tavily',
				name: 'Tavily',
				baseUrl: 'https://api.tavily.com/search',
				apiKey: 'tavily-key',
			},
		]);
		expect(getSearchSettings().engineId).toBe('tavily');
		expect(getSearchKey('tavily')).toBe('tavily-key');
		expect(selectSearchEngine('brave').engineId).toBe('brave');
		expect(getSearchEngine()).toEqual({
			providerId: 'brave',
			providerName: 'Brave',
			enabled: true,
		});
	});

	it('rejects empty credentials and unconfigured selections', () => {
		expect(() => saveSearchEngine('brave', { apiKey: ' ' })).toThrow('API key is required');
		expect(() => selectSearchEngine('tavily')).toThrow('Configure this search engine');
	});

	it('removes one key and clears its selection only when selected', () => {
		saveSearchEngine('brave', { apiKey: 'brave-key' });
		saveSearchEngine('tavily', { apiKey: 'tavily-key' });
		selectSearchEngine('brave');
		expect(removeSearchEngine('tavily')).toEqual({
			engineId: 'brave',
			configured: { brave: true, tavily: false },
		});
		expect(removeSearchEngine('brave')).toEqual({
			engineId: null,
			configured: { brave: false, tavily: false },
		});
		expect(getSearchProviders()).toEqual([]);
		expect(getSearchEngine()).toEqual({ providerId: '', providerName: '', enabled: false });
	});

	it('falls back to Brave environment credentials without exposing them as stored', () => {
		process.env.BRAVE_API_KEY = ' environment-key ';
		expect(getSearchKey('brave')).toBe('environment-key');
		expect(getSearchSettings().configured.brave).toBe(false);
	});

	it('normalizes malformed persisted state', () => {
		setSearchProviders([
			{ id: 'brave', name: 'Brave', apiKey: 42, baseUrl: 'https://brave.test' },
		] as never);
		expect(getSearchSettings()).toEqual({
			engineId: null,
			configured: { brave: false, tavily: false },
		});
	});
});

describe('search adapters', () => {
	it('calls Brave with its GET contract and normalizes results', async () => {
		(global.fetch as jest.Mock).mockResolvedValue(
			response({
				web: {
					results: [{ title: 'Brave result', url: 'https://brave.example', description: 'Text' }],
				},
			})
		);

		await expect(searchBrave({ query: 'kucedr', count: 3 }, 'brave-key')).resolves.toEqual({
			query: 'kucedr',
			results: [{ title: 'Brave result', url: 'https://brave.example', description: 'Text' }],
		});
		const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [URL, RequestInit];
		expect(url.toString()).toBe('https://api.search.brave.com/res/v1/web/search?q=kucedr&count=3');
		expect(init.headers).toEqual({
			Accept: 'application/json',
			'X-Subscription-Token': 'brave-key',
		});
	});

	it('calls Tavily with its POST contract and normalizes content', async () => {
		(global.fetch as jest.Mock).mockResolvedValue(
			response({
				results: [{ title: 'Tavily result', url: 'https://tavily.example', content: 'Text' }],
			})
		);

		await expect(searchTavily({ query: 'kucedr', count: 4 }, 'tavily-key')).resolves.toEqual({
			query: 'kucedr',
			results: [{ title: 'Tavily result', url: 'https://tavily.example', description: 'Text' }],
		});
		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.tavily.com/search',
			expect.objectContaining({
				method: 'POST',
				headers: {
					Accept: 'application/json',
					Authorization: 'Bearer tavily-key',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					query: 'kucedr',
					max_results: 4,
					search_depth: 'basic',
					include_answer: false,
					include_raw_content: false,
				}),
			})
		);
	});

	it('reports provider failures without changing the normalized API', async () => {
		(global.fetch as jest.Mock).mockResolvedValue(response({}, 401, 'Unauthorized'));
		await expect(searchTavily({ query: 'kucedr', count: 5 }, 'bad-key')).rejects.toThrow(
			'Tavily search failed (401): Unauthorized'
		);
	});
});

describe('generic web search', () => {
	it('omits web_search when no search API key is stored', () => {
		process.env.BRAVE_API_KEY = 'environment-key';
		expect(getSearchWebTools()).toEqual([]);
	});

	it('omits web_search when an API key is configured but no engine is selected', () => {
		saveSearchEngine('brave', { apiKey: 'brave-key' });
		expect(getSearchWebTools()).toEqual([]);
	});

	it.each([
		['brave', 'brave-key'],
		['tavily', 'tavily-key'],
	] as const)('includes web_search when %s is configured and selected', (engineId, apiKey) => {
		saveSearchEngine(engineId, { apiKey });
		selectSearchEngine(engineId);
		expect(getSearchWebTools().map((searchTool) => searchTool.id)).toEqual(['search_web']);
	});

	it('dispatches to the selected provider at execution time', async () => {
		saveSearchEngine('tavily', { apiKey: 'tavily-key' });
		selectSearchEngine('tavily');
		(global.fetch as jest.Mock).mockResolvedValue(response({ results: [] }));
		const controller = new AbortController();

		await expect(
			searchWeb({ query: 'current events', count: 2 }, controller.signal)
		).resolves.toEqual({
			query: 'current events',
			results: [],
		});
		expect(global.fetch).toHaveBeenCalledWith(
			'https://api.tavily.com/search',
			expect.objectContaining({ method: 'POST', signal: controller.signal })
		);
	});

	it('keeps the web_search tool output contract and default count', async () => {
		saveSearchEngine('brave', { apiKey: 'brave-key' });
		selectSearchEngine('brave');
		(global.fetch as jest.Mock).mockResolvedValue(response({ web: { results: [] } }));

		const [webSearchTool] = getSearchWebTools();
		const output = await webSearchTool.run({ query: 'kucedr' });
		expect(JSON.parse(output as string)).toEqual({ query: 'kucedr', results: [] });
		const [url] = (global.fetch as jest.Mock).mock.calls[0] as [URL];
		expect(url.searchParams.get('count')).toBe('5');
	});

	it('explains how to select a search engine', async () => {
		await expect(searchWeb({ query: 'kucedr' })).rejects.toThrow(
			'Select a search engine in Settings > Agent'
		);
	});
});
