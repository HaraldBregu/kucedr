import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels, loadProviders } from '../../../../src/main/models';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/openrouter');
		const plugin = readPlugin(directory, 'openrouter', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'openrouter', name: 'OpenRouter' } }];
	},
}));

it('loads the bundled OpenRouter provider and its icon', () => {
	const plugin = readPlugin(path.resolve('resources/plugins/openrouter'), 'openrouter', true);

	expect(plugin).toMatchObject({
		title: 'OpenRouter',
		icon: 'openrouter-light.svg',
		iconDark: 'openrouter-dark.svg',
		provider: {
			apiKeyUrl: 'https://openrouter.ai/settings/keys',
			baseUrl: 'https://openrouter.ai/api/v1',
			modelsUrl: 'https://openrouter.ai/api/v1/models',
			modelUrl: 'https://openrouter.ai/{id}',
			models: expect.arrayContaining([
				expect.objectContaining({ id: 'openrouter/auto', metadata: expect.objectContaining({ inputs: {} }) }),
				expect.objectContaining({ id: 'remote', discoveryOnly: true, modelsUrl: 'https://openrouter.ai/api/v1/models', metadata: expect.objectContaining({ discoveryInputs: expect.objectContaining({ reasoning: expect.any(Object) }) }) }),
			]),
		},
	});
});


it('exposes remote discovery and its options without listing the discovery entry as a model', () => {
	expect(loadProviders()).toContainEqual(expect.objectContaining({ id: 'openrouter', modelsUrl: 'https://openrouter.ai/api/v1/models', discoveryInputs: expect.objectContaining({ reasoning: expect.any(Object) }) }));
	expect(loadModels().filter((model) => model.provider.id === 'openrouter').map((model) => model.id)).toEqual(['openrouter/auto']);
});
