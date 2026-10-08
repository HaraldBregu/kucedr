import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';
import { llmBuildChatMessages, llmToTranscriptEntry } from '../../../../src/main/models/adapters/llm/llm_shared';
import type { LlmEvent, LlmRequest } from '../../../../src/main/models/adapters/llm/llm_types';

it('replays DeepSeek reasoning_content with the tool call after authorization', async () => {
	const create = jest.fn().mockResolvedValue({
		async *[Symbol.asyncIterator]() {
			yield { choices: [{ delta: { reasoning_content: 'private reasoning' } }] };
			yield {
				choices: [{
					delta: {
						tool_calls: [{ index: 0, id: 'call-1', function: { name: 'lookup', arguments: '{"id":1}' } }],
					},
					finish_reason: 'tool_calls',
				}],
			};
		},
	});
	const model = new LlmModel({
		openAIClientFactory: () => ({ chat: { completions: { create } } }) as never,
	});
	const request: LlmRequest = {
		provider: { id: 'deepseek', apiKey: 'key' },
		model: 'deepseek-reasoner',
		messages: [{ role: 'user', content: 'look this up' }],
		tools: [{
			id: 'lookup', name: 'lookup', description: 'Look up data', schema: { type: 'object' },
			risk: 'low', effect: 'read', timeoutMs: 1_000, maxOutputBytes: 1_000,
			parseInput: (value) => value as Record<string, unknown>, run: () => undefined,
		}],
		maxTokens: 100,
		streaming: true,
	};
	const events: LlmEvent[] = [];
	for await (const event of model.stream(request)) events.push(event);

	expect(events).toContainEqual({
		type: 'model_provider_item', provider: 'deepseek', item: 'private reasoning',
	});
	const assistant = {
		role: 'assistant' as const,
		content: events.filter((event) => event.type === 'model_provider_item').map((event) => ({
			type: 'provider_item', provider: event.provider, item: event.item,
		})),
		toolCalls: [{
			id: 'call-1', name: 'lookup', args: { id: 1 },
			result: { content: 'authorized result' },
		}],
	};
	const replay = llmBuildChatMessages('', llmToTranscriptEntry(assistant), {
		includeReasoningContent: true,
	});
	expect(replay).toEqual([
		{
			role: 'assistant', content: null, reasoning_content: 'private reasoning',
			tool_calls: [{
				id: 'call-1', type: 'function', function: { name: 'lookup', arguments: '{"id":1}' },
			}],
		},
		{ role: 'tool', tool_call_id: 'call-1', content: 'authorized result' },
	]);
});
