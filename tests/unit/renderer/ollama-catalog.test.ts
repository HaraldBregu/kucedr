import { loadModels, providerModels, providers } from '../../../src/renderer/src/lib/providers';

it('lists only models discovered from Ollama', async () => {
	const provider = { id: 'ollama', name: 'Ollama', baseUrl: 'http://localhost:11434/v1', modelsUrl: 'http://localhost:11434/v1/models' };
	Object.assign(window, {
		app: { models: async () => [], vectorDatabases: async () => [], mcps: async () => [], storages: async () => [] },
		services: { list: async () => [] },
		provider: { getModelProviders: async () => [provider], listModels: async () => [{ id: 'llama3.2:latest', name: 'llama3.2:latest' }] },
	});
	await loadModels();
	expect(providers()).toContainEqual(provider);
	expect(providerModels('ollama', 'llm')).toEqual([{ id: 'llama3.2:latest', name: 'llama3.2:latest' }]);
});
