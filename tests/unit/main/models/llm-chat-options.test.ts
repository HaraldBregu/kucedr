import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

it.each([true, false])('preserves chat tool choice with streaming=%s', async (streaming) => {
	const create = jest.fn().mockImplementation(async () =>
		streaming
			? (async function* () {
					yield { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] };
				})()
			: { choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }], usage: {} }
	);
	const model = new LlmModel({
		chatClientFactory: () => ({ chat: { completions: { create } } }) as never,
	});
	const tool = {
		id: 'lookup', category: 'integration', name: 'lookup', description: 'Lookup',
		schema: { type: 'object' }, timeoutMs: 1000, maxOutputBytes: 1000,
		parseInput: (value: unknown) => value as Record<string, unknown>, run: () => undefined,
	} as const;
	const choice = { type: 'function', function: { name: 'lookup' } };
	for await (const _event of model.stream({
		provider: { id: 'compatible', apiKey: 'key' }, model: 'model',
		messages: [{ role: 'user', content: 'hello' }], tools: [tool], maxTokens: 100,
		options: { tool_choice: choice, stream_options: { include_usage: false, custom: true } },
		streaming,
	})) { /* consume */ }
	expect(create.mock.calls[0][0]).toEqual(expect.objectContaining({
		tool_choice: choice,
		stream_options: streaming ? { include_usage: false, custom: true } : undefined,
	}));
});
