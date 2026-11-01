import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';

it('loads the bundled OpenRouter provider and its icon', () => {
	const plugin = readPlugin(path.resolve('resources/plugins/openrouter'), 'openrouter', true);

	expect(plugin).toMatchObject({
		title: 'OpenRouter',
		icon: 'openrouter-light.svg',
		iconDark: 'openrouter-dark.svg',
		provider: { modelsUrl: 'https://openrouter.ai/api/v1/models' },
	});
});
