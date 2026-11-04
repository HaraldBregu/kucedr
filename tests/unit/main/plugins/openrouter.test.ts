import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';

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
