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
			models: [expect.objectContaining({ id: 'openrouter/auto', metadata: expect.objectContaining({ inputs: {}, discoveryInputs: expect.objectContaining({ reasoning: expect.objectContaining({ properties: expect.objectContaining({ effort: expect.objectContaining({ enum: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] }) }) }) }) }) })],
		},
	});
});
