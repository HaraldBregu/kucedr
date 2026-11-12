import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => ['openai', 'inception'].map((id) => {
		const directory = path.resolve('resources/plugins', id);
		const plugin = readPlugin(directory, id, true);
		return { directory, manifest: plugin.provider, plugin: { id, name: plugin.title } };
	}),
}));

it('declares a supported protocol on every bundled chat and discovery model', () => {
	const root = path.resolve('resources/plugins');
	const missing: string[] = [];
	for (const plugin of readdirSync(root, { withFileTypes: true })) {
		if (!plugin.isDirectory()) continue;
		const directory = path.join(root, plugin.name, 'models');
		let models;
		try {
			models = readdirSync(directory, { withFileTypes: true });
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
			throw error;
		}
		for (const model of models) {
			if (!model.isDirectory()) continue;
			const file = path.join(directory, model.name, 'manifest.json');
			const manifest = JSON.parse(readFileSync(file, 'utf8')) as {
				id: string; type: string; metadata?: { protocol?: string };
			};
			if (manifest.type === 'large-language-model' &&
				!['responses', 'messages', 'chat-completions'].includes(manifest.metadata?.protocol ?? '')) {
				missing.push(`${plugin.name}/${manifest.id}`);
			}
		}
	}
	expect(missing).toEqual([]);
});

it('routes bundled GPT-5.4 Mini to Responses and Mercury 3 to Chat Completions', async () => {
	const responses = jest.fn().mockResolvedValue({
		id: 'resp', status: 'completed',
		output: [{ type: 'message', content: [{ type: 'output_text', text: 'openai answer' }] }],
		usage: { input_tokens: 1, output_tokens: 1 },
	});
	const completions = jest.fn().mockResolvedValue({
		choices: [{ message: { content: 'mercury answer' }, finish_reason: 'stop' }], usage: {},
	});
	const model = new LlmModel({
		chatClientFactory: () => ({ responses: { create: responses }, chat: { completions: { create: completions } } }) as never,
	});
	for (const [provider, modelId, answer] of [
		['openai', 'gpt-5.4-mini', 'openai answer'],
		['inception', 'mercury-3', 'mercury answer'],
	] as const) {
		const events = [];
		for await (const event of model.stream({
			provider: { id: provider, apiKey: 'test' }, model: modelId,
			messages: [{ role: 'user', content: 'Hello' }], maxTokens: 100, streaming: false,
		})) events.push(event);
		expect(events).toContainEqual({ type: 'model_call_delta', delta: answer });
	}
	expect(responses).toHaveBeenCalledTimes(1);
	expect(responses.mock.calls[0][0]).toEqual(expect.objectContaining({ model: 'gpt-5.4-mini', stream: false }));
	expect(completions).toHaveBeenCalledTimes(1);
	expect(completions.mock.calls[0][0]).toEqual(expect.objectContaining({ model: 'mercury-3', stream: false }));
});
