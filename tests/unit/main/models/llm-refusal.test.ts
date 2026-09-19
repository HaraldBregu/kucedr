import { LlmModel } from '../../../../src/main/models/adapters/llm/llm_model';
import type { LlmEvent } from '../../../../src/main/models/adapters/llm/llm_types';

describe('OpenAI Responses refusal delivery', () => {
	it.each([true, false])('preserves refusal text with streaming=%s', async (streaming) => {
		const refusal = 'I cannot help with that request.';
		const response = {
			id: 'response-1',
			status: 'completed',
			output: [{ type: 'message', content: [{ type: 'refusal', refusal }] }],
			usage: { input_tokens: 3, output_tokens: 7 },
		};
		const create = jest.fn().mockResolvedValue(
			streaming
				? (async function* () {
						yield { type: 'response.refusal.delta', delta: 'I cannot help ' };
						yield { type: 'response.refusal.delta', delta: 'with that request.' };
						yield { type: 'response.refusal.done', refusal };
						yield { type: 'response.output_item.done', item: response.output[0] };
						yield { type: 'response.completed', response };
					})()
				: response
		);
		const model = new LlmModel({
			openAIClientFactory: () => ({ responses: { create } }) as never,
		});
		const events: LlmEvent[] = [];
		for await (const event of model.stream({
			provider: { id: 'openai', apiKey: 'key' },
			model: 'model',
			messages: [{ role: 'user', content: 'request' }],
			maxTokens: 100,
			streaming,
		}))
			events.push(event);

		expect(
			events.flatMap((event) => (event.type === 'model_call_delta' ? [event.delta] : [])).join('')
		).toBe(refusal);
		expect(events.at(-1)).toEqual(
			expect.objectContaining({
				type: 'model_call_end',
				stopReason: 'end_turn',
				usage: { inputTokens: 3, outputTokens: 7 },
			})
		);
	});
});
