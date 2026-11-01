import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { getResolvedProvider } from '../../../../src/main/settings_store';
import { getSearchKey } from '../../../../src/main/search/search_get_key';

jest.mock('../../../../src/main/plugins/plugins_settings', () => ({
	pluginSettings: (id: string) =>
		id === 'openai' || id === 'tavily' ? { apiKey: `${id}-master` } : {},
}));
jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/openai');
		const plugin = readPlugin(directory, 'openai', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'openai', name: 'OpenAI' } }];
	},
}));
jest.mock('../../../../src/main/search/search_store', () => ({ getSearchProviders: () => [] }));

it('uses the plugin master API key for model and search requests', () => {
	expect(getResolvedProvider('openai')?.apiKey).toBe('openai-master');
	expect(getSearchKey('tavily')).toBe('tavily-master');
});
