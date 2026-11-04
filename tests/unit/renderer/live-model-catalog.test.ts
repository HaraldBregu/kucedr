import {
	loadModels,
	liveProviderModels,
	providerModels,
} from '../../../src/renderer/src/lib/providers';
import { loadModelCatalog } from '../../../src/renderer/src/pages/settings/pages/models/catalog';
import type { CatalogModel, ProviderModel } from '../../../src/shared/model_types';

it('refreshes metadata for duplicate live models while preserving bundled catalog defaults', async () => {
	const provider = {
		id: 'openrouter',
		name: 'OpenRouter',
		plugin: 'openrouter',
		modelsUrl: 'https://example.test/models',
	};
	const bundled: CatalogModel = {
		id: 'model-a',
		name: 'Bundled model',
		type: 'llm',
		location: 'remote',
		provider,
		default: true,
		metadata: { documentationUrl: 'https://example.test/bundled', contextWindow: 100, inputs: {} },
	};
	const live: ProviderModel = {
		id: 'model-a',
		name: 'Live model',
		discovered: true,
		metadata: {
			documentationUrl: 'https://example.test/live',
			inputs: { reasoning: { properties: { effort: { enum: ['low', 'high'] } } } },
		},
	};
	const listModels = jest
		.fn()
		.mockResolvedValue([live, { id: 'model-b', name: 'Model B', discovered: true }]);
	Object.assign(window, {
		app: {
			models: async () => [bundled],
			vectorDatabases: async () => [],
			mcps: async () => [],
			storages: async () => [],
		},
		services: { list: async () => [] },
		provider: { getModelProviders: async () => [provider], listModels },
	});

	await loadModels();
	const homeModels = await liveProviderModels('openrouter', providerModels('openrouter', 'llm'));
	expect(homeModels).toHaveLength(2);
	expect(homeModels[0].discovered).toBeFalsy();
	expect(homeModels[1].discovered).toBe(true);
	expect(homeModels[0]).toMatchObject({
		name: 'Live model',
		metadata: { contextWindow: 100, inputs: live.metadata?.inputs },
	});
	const settingsModels = await loadModelCatalog();
	expect(settingsModels).toHaveLength(2);
	expect(settingsModels[0]).toMatchObject({
		default: true,
		metadata: { contextWindow: 100, inputs: live.metadata?.inputs },
	});
});
