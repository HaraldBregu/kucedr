import path from 'node:path';
import { readPlugin } from '../../../../src/main/plugins/plugins_read';
import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/plugins/plugins_providers', () => ({
	pluginProviders: () => {
		const directory = path.resolve('resources/plugins/inception');
		const plugin = readPlugin(directory, 'inception', true);
		return [
			{ directory, manifest: plugin.provider, plugin: { id: 'inception', name: 'Inception' } },
		];
	},
}));

it.each([true, false])('reads cached input usage from Inception when streaming=%s', async (streaming) => {
	const usage = { prompt_tokens: 20, completion_tokens: 3, cached_input_tokens: 12 };
	const create = jest.fn().mockImplementation(async () =>
		streaming
			? (async function* () {
					yield { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] };
					yield { choices: [], usage };
				})()
			: { choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }], usage }
	);
	const model = new LlmModel({
		chatClientFactory: () => ({ chat: { completions: { create } } }) as never,
	});
	const events = [];
	for await (const event of model.stream({
		provider: { id: 'inception', apiKey: 'key' },
		model: 'mercury-3',
		messages: [{ role: 'user', content: 'hello' }],
		maxTokens: 123,
		streaming,
	})) events.push(event);
	expect(events).toContainEqual(expect.objectContaining({
		type: 'model_call_end',
		usage: expect.objectContaining({ inputTokens: 20, outputTokens: 3, cachedTokens: 12 }),
	}));
});
