import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { loadModels, loadProviders } from '../../../../src/main/models';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/ollama');
		const plugin = readPlugin(directory, 'ollama', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'ollama', name: 'Ollama' } }];
	},
}));

it('exposes Ollama discovery URLs without exposing the discovery entry as a model', () => {
	expect(loadProviders()).toContainEqual(expect.objectContaining({
		id: 'ollama',
		baseUrl: 'http://localhost:11434/v1',
		modelsUrl: 'http://localhost:11434/v1/models',
	}));
	expect(loadModels().filter((model) => model.provider.id === 'ollama')).toEqual([]);
});
