import path from 'node:path';
import { loadModels, loadProviders } from '../../../../src/main/models';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => ['anthropic', 'deepseek', 'inception', 'iteracompute', 'ollama', 'openai', 'openrouter', 'xai'].map((id) => {
		const directory = path.resolve('resources/plugins', id);
		const plugin = readPlugin(directory, id, true);
		return { directory, manifest: plugin.provider, plugin: { id, name: plugin.title } };
	}),
}));

it('routes each bundled chat model and discovered model through its declared SDK protocol', async () => {
	const responses = jest.fn().mockResolvedValue({ id: 'response', status: 'completed', output: [], usage: {} });
	const completions = jest.fn().mockResolvedValue({ choices: [], usage: {} });
	const messages = jest.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } });
	const model = new LlmModel({
		chatClientFactory: () => ({ responses: { create: responses }, chat: { completions: { create: completions } } }) as never,
		messagesClientFactory: () => ({ messages: { create: messages } }) as never,
	});
	const entries = loadModels().filter((entry) => entry.type === 'llm').map((entry) => ({
		provider: entry.provider.id, id: entry.id, protocol: entry.metadata?.protocol,
	}));
	for (const provider of loadProviders()) {
		if (provider.discoveryMetadata?.protocol) entries.push({ provider: provider.id, id: 'discovered-test-model', protocol: provider.discoveryMetadata.protocol });
	}
	expect(entries.length).toBeGreaterThan(30);
	for (const entry of entries) {
		responses.mockClear(); completions.mockClear(); messages.mockClear();
		for await (const _event of model.stream({
			provider: { id: entry.provider, apiKey: 'test' }, model: entry.id,
			messages: [{ role: 'user', content: 'Hello' }], maxTokens: 128, streaming: false,
		})) { void _event; }
		const calls = { responses, 'chat-completions': completions, messages };
		expect(calls[entry.protocol as keyof typeof calls]).toHaveBeenCalledTimes(1);
		expect(calls[entry.protocol as keyof typeof calls].mock.calls[0][0].model).toBe(entry.id);
	}
});
