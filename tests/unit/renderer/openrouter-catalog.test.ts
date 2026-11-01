import { loadModels, providerModels, providers } from '../../../src/renderer/src/lib/providers';

it('discovers a provider without bundled models and loads its live model catalog', async () => {
	const provider = { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', modelsUrl: 'https://openrouter.ai/api/v1/models' };
	Object.assign(window, {
		app: { models: async () => [], vectorDatabases: async () => [], mcps: async () => [], storages: async () => [] },
		services: { list: async () => [] },
		provider: { getModelProviders: async () => [provider], listModels: async () => [{ id: 'vendor/model', name: 'Model' }] },
	});

	await loadModels();

	expect(providers()).toContainEqual(provider);
	expect(providerModels('openrouter', 'llm')).toEqual([{ id: 'vendor/model', name: 'Model' }]);
});
