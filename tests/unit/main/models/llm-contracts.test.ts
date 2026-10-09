import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';
import {
	llmBuildAnthropicMessages,
	llmToTranscriptEntry,
} from '../../../../src/main/models/adapters/llm/llm_shared';
import type { LlmEvent, LlmRequest } from '../../../../src/main/models/adapters/llm/llm_types';

it('preserves signed Anthropic thinking when returning tool results', async () => {
	const thinking = { type: 'thinking', thinking: '', signature: 'signed' };
	const create = jest
		.fn()
		.mockResolvedValue({
			content: [thinking, { type: 'tool_use', id: 'tool', name: 'lookup', input: {} }],
			stop_reason: 'tool_use',
			usage: { input_tokens: 1, output_tokens: 1 },
		});
	const model = new LlmModel({ anthropicClientFactory: () => ({ messages: { create } }) as never });
	const events: LlmEvent[] = [];
	for await (const event of model.stream({
		provider: { id: 'anthropic', apiKey: 'key' },
		model: 'claude-opus-5-5',
		messages: [{ role: 'user', content: 'hello' }],
		maxTokens: 100,
		streaming: false,
	}))
		events.push(event);
	expect(events).toContainEqual({
		type: 'model_provider_item',
		provider: 'anthropic',
		item: thinking,
	});
	const history = llmToTranscriptEntry({
		role: 'assistant',
		content: [{ type: 'provider_item', provider: 'anthropic', item: thinking }],
		toolCalls: [{ id: 'tool', name: 'lookup', args: {}, result: { content: 'done' } }],
	});
	expect(llmBuildAnthropicMessages(history)[0].content).toEqual([
		thinking,
		{ type: 'tool_use', id: 'tool', name: 'lookup', input: {} },
	]);
});

it.each([true, false])(
	'reads Mistral thinking and text chunks with streaming=%s',
	async (streaming) => {
		const thinking = { type: 'thinking', thinking: [{ type: 'text', text: 'reasoning' }] };
		const create = jest.fn().mockImplementation(async () =>
			streaming
				? (async function* () {
						yield {
							choices: [{ delta: { content: [thinking, { type: 'text', text: 'answer' }] } }],
						};
						yield { choices: [{ delta: { content: ' continues' }, finish_reason: 'stop' }] };
					})()
				: {
						choices: [
							{
								message: { content: [thinking, { type: 'text', text: 'answer continues' }] },
								finish_reason: 'stop',
							},
						],
						usage: {},
					}
		);
		const model = new LlmModel({
			openAIClientFactory: () => ({ chat: { completions: { create } } }) as never,
		});
		const request: LlmRequest = {
			provider: { id: 'mistral', apiKey: 'key' },
			model: 'mistral-large-4',
			messages: [{ role: 'user', content: 'hello' }],
			maxTokens: 100,
			streaming,
		};
		const events: LlmEvent[] = [];
		for await (const event of model.stream(request)) events.push(event);
		expect(
			events
				.filter((event) => event.type === 'model_call_delta')
				.map((event) => event.delta)
				.join('')
		).toBe('answer continues');
		expect(events).toContainEqual({
			type: 'model_provider_item',
			provider: 'mistral',
			item: thinking,
		});
	}
);

it('maps Cohere reasoning effort only on models with documented support', async () => {
	const create = jest.fn().mockResolvedValue({ choices: [], usage: {} });
	const model = new LlmModel({ openAIClientFactory: (spec) => {
		expect(spec.baseURL).toBe('https://api.cohere.ai/compatibility/v1');
		return { chat: { completions: { create } } } as never;
	} });
	for (const modelId of ['command-a-plus-05-2026', 'command-a-reasoning-08-2025', 'command-r-plus-08-2024']) {
		for await (const _event of model.stream({ provider: { id: 'cohere', apiKey: 'key', baseURL: 'https://api.cohere.com/v2' }, model: modelId, effort: 'low', messages: [{ role: 'user', content: 'hello' }], maxTokens: 100, streaming: false })) {}
	}
	expect(create.mock.calls[0][0].reasoning_effort).toBe('high');
	expect(create.mock.calls[1][0].reasoning_effort).toBe('high');
	expect(create.mock.calls[2][0].reasoning_effort).toBeUndefined();
});
