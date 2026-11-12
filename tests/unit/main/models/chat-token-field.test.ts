import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

jest.mock('../../../../src/main/models/adapters/llm/metadata', () => ({
	metadata: (_provider: string, model: string) => ({
		protocol: 'chat-completions',
		...(model === 'modern' ? { outputTokensField: 'max_completion_tokens' } : {}),
	}),
}));

it.each([true, false])('uses the model token field with streaming=%s', async (streaming) => {
	const create = jest.fn().mockImplementation(async () => streaming
		? (async function* () { yield { choices: [{ delta: { content: 'answer' }, finish_reason: 'stop' }] }; })()
		: { choices: [{ message: { content: 'answer' }, finish_reason: 'stop' }], usage: {} });
	const model = new LlmModel({ chatClientFactory: () => ({ chat: { completions: { create } } }) as never });
	for (const modelId of ['modern', 'legacy']) {
		for await (const _event of model.stream({
			provider: { id: 'test', apiKey: 'key', baseURL: 'https://example.com/v1' },
			model: modelId,
			messages: [{ role: 'user', content: 'hello' }],
			maxTokens: 123,
			streaming,
		})) { void _event; }
	}
	expect(create.mock.calls[0][0].max_completion_tokens).toBe(123);
	expect(create.mock.calls[0][0].max_tokens).toBeUndefined();
	expect(create.mock.calls[1][0].max_tokens).toBe(123);
	expect(create.mock.calls[1][0].max_completion_tokens).toBeUndefined();
});
