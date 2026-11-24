import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';

it.each([true, false])('sends supported effort to OpenAI with streaming=%s', async (streaming) => {
	const create = jest.fn().mockImplementation(async () => streaming ? (async function* () { yield* []; })() : { id: 'r', output: [], usage: {} });
	const model = new LlmModel({ chatClientFactory: () => ({ responses: { create } }) as never });
	for await (const _event of model.stream({ provider: { id: 'openai', apiKey: 'key' }, model: 'gpt-6-astra', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, effort: 'none', streaming })) { void _event; }
	expect(create.mock.calls[0][0].reasoning.effort).toBe('low');
});

it.each([true, false])('sends supported effort to Anthropic with streaming=%s', async (streaming) => {
	const create = jest.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } });
	const stream = jest.fn().mockReturnValue((async function* () { yield* []; })());
	const model = new LlmModel({ messagesClientFactory: () => ({ messages: { create, stream } }) as never });
	for await (const _event of model.stream({ provider: { id: 'anthropic', apiKey: 'key' }, model: 'claude-opus-5-5', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, effort: 'max', streaming })) { void _event; }
	expect((streaming ? stream : create).mock.calls[0][0].output_config.effort).toBe('max');
});

it('omits automatic effort for a model without documented support', async () => {
	const create = jest.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } });
	const model = new LlmModel({ messagesClientFactory: () => ({ messages: { create } }) as never });
	for await (const _event of model.stream({ provider: { id: 'anthropic', apiKey: 'key' }, model: 'claude-haiku-4-5-20251001', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, effort: 'high', streaming: false })) { void _event; }
	expect(create.mock.calls[0][0].output_config).toBeUndefined();
});
