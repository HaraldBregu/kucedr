import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels } from '../../../../src/main/models';
import { createEmbedding } from '../../../../src/main/models/embedding/embedding_create';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/openai');
		const plugin = readPlugin(directory, 'openai', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'openai', name: plugin.title } }];
	},
}));
jest.mock('../../../../src/main/settings_store', () => ({
	getProvider: () => ({ apiKey: 'test-key' }),
}));
jest.mock('../../../../src/main/models/selection', () => ({
	getProviderId: () => undefined,
	getModelId: () => undefined,
}));

it.each(['text-embedding-3-small', 'text-embedding-3-large'])('uses bundled %s embedding contract', async (modelId) => {
	const model = loadModels().find((entry) => entry.provider.id === 'openai' && entry.id === modelId);
	expect(model?.metadata?.protocol).toBe('embeddings');
	const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ model: modelId, data: [{ index: 1, embedding: [0.3, 0.4] }, { index: 0, embedding: [0.1, 0.2] }] })));
	try {
		await expect(createEmbedding({ providerId: 'openai', modelId, texts: [' first ', 'second'] })).resolves.toEqual({ providerId: 'openai', modelId, dimensions: 2, embeddings: [[0.1, 0.2], [0.3, 0.4]] });
		expect(String(fetcher.mock.calls[0][0])).toBe('https://api.openai.com/v1/embeddings');
		const init = fetcher.mock.calls[0][1]!;
		expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-key');
		expect(JSON.parse(String(init.body))).toEqual({ model: modelId, input: ['first', 'second'], encoding_format: 'float' });
	} finally { fetcher.mockRestore(); }
});
