import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { getResolvedProvider } from '../../../../src/main/settings_store';
import { getStoredSearchProviders } from '../../../../src/main/search/search_get_providers';

jest.mock('../../../../src/main/plugins/plugins_settings', () => ({
	pluginSettings: (id: string) =>
		id === 'openai' || id === 'tavily' ? { apiKey: `${id}-master` } : {},
}));
jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () =>
		['openai', 'tavily'].map((id) => {
			const directory = path.resolve(`resources/plugins/${id}`);
			const plugin = readPlugin(directory, id, true);
			return { directory, manifest: plugin.provider, plugin: { id, name: id } };
		}),
}));
jest.mock('../../../../src/main/search/search_store', () => ({ getSearchProviders: () => [] }));

it('uses the plugin master API key for model and search requests', () => {
	expect(getResolvedProvider('openai')?.apiKey).toBe('openai-master');
	expect(getStoredSearchProviders().find((provider) => provider.id === 'tavily')?.apiKey).toBe(
		'tavily-master'
	);
});
