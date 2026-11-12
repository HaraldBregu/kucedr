import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/xai');
		const plugin = readPlugin(directory, 'xai', true);
		return [{ directory, manifest: plugin.provider, plugin: { id: 'xai', name: plugin.title } }];
	},
}));

it.each([['none', 'low'], ['xhigh', 'xhigh']] as const)(
	'maps Grok 4.6 effort %s to supported value %s',
	async (effort, expected) => {
		const create = jest.fn().mockResolvedValue({ choices: [], usage: {} });
		const model = new LlmModel({
			chatClientFactory: () => ({ chat: { completions: { create } } }) as never,
		});
		for await (const _event of model.stream({
			provider: { id: 'xai', apiKey: 'test' }, model: 'grok-4.6', effort,
			messages: [{ role: 'user', content: 'Hello' }], maxTokens: 100, streaming: false,
		})) { void _event; }
		expect(create.mock.calls[0][0].reasoning_effort).toBe(expected);
	}
);

it('does not advertise stop sequences for reasoning models', () => {
	const plugin = readPlugin(path.resolve('resources/plugins/xai'), 'xai', true);
	for (const id of ['grok-4.5', 'grok-4.6', 'grok-4.7']) {
		const model = plugin.provider?.models?.find((entry) => entry.id === id);
		expect(model?.metadata?.inputs).not.toHaveProperty('stop');
	}
});
