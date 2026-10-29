import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';
import * as catalog from '../../../../src/main/models';

jest.spyOn(catalog, 'providerModels').mockImplementation((provider) => {
	const field = provider === 'openai' ? 'reasoning' : 'output_config';
	return [{ id: 'supported', name: 'Supported', metadata: { documentationUrl: '', inputs: { [field]: { properties: { effort: { enum: ['low', 'medium', 'high', 'xhigh', 'max'] } } } } } }];
});

it.each([true, false])('sends supported effort to OpenAI with streaming=%s', async (streaming) => {
	const create = jest.fn().mockImplementation(async () => streaming ? (async function* () {})() : { id: 'r', output: [], usage: {} });
	const model = new LlmModel({ openAIClientFactory: () => ({ responses: { create } }) as never });
	for await (const _ of model.stream({ provider: { id: 'openai', apiKey: 'key' }, model: 'supported', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, effort: 'none', streaming })) {}
	expect(create.mock.calls[0][0].reasoning.effort).toBe('low');
});

it.each([true, false])('sends supported effort to Anthropic with streaming=%s', async (streaming) => {
	const create = jest.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } });
	const stream = jest.fn().mockReturnValue((async function* () {})());
	const model = new LlmModel({ anthropicClientFactory: () => ({ messages: { create, stream } }) as never });
	for await (const _ of model.stream({ provider: { id: 'anthropic', apiKey: 'key' }, model: 'supported', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, effort: 'max', streaming })) {}
	expect((streaming ? stream : create).mock.calls[0][0].output_config.effort).toBe('max');
});

it('omits automatic effort for a model without documented support', async () => {
	const create = jest.fn().mockResolvedValue({ content: [], stop_reason: 'end_turn', usage: { input_tokens: 0, output_tokens: 0 } });
	const model = new LlmModel({ anthropicClientFactory: () => ({ messages: { create } }) as never });
	for await (const _ of model.stream({ provider: { id: 'anthropic', apiKey: 'key' }, model: 'unknown', messages: [{ role: 'user', content: 'hi' }], maxTokens: 100, effort: 'high', streaming: false })) {}
	expect(create.mock.calls[0][0].output_config).toBeUndefined();
});
