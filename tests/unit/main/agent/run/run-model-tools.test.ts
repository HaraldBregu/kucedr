const findModel = jest.fn(() => ({
	metadata: {
		contextWindow: 1_048_576,
		defaultOutputTokens: 32_768,
		inputs: { max_tokens: { type: 'integer', maximum: 384_000 } },
	},
}));

jest.mock('../../../../../src/main/models', () => ({ findModel }));

import { runModelTurn } from '../../../../../src/main/agent/runner/run_model_turn';
import { jsonTool } from '../../../../../src/main/agent/tools/tool';
import type { ModelTurnStream } from '../../../../../src/main/agent/runner/run_model_turn';
import type { ResolvedProvider } from '../../../../../src/shared/provider_types';

it('submits every selected tool to a model with documented context metadata', async () => {
	const tools = Array.from({ length: 80 }, (_, index) =>
		jsonTool({
			name: `tool_${index}`,
			description: `Tool ${index} ${'capability '.repeat(40)}`,
			schema: { type: 'object', properties: { value: { type: 'string' } } },
			execute: () => undefined,
		})
	);
	const modelStream = jest.fn(() =>
		(async function* () {
			yield {
				type: 'model_call_end' as const,
				model: 'deepseek-flash',
				stopReason: 'end_turn',
			};
		})()
	);
	const events = runModelTurn(
		{ task: 'chat', message: 'hello' },
		{ id: 'deepseek', apiKey: 'key' } as ResolvedProvider,
		'deepseek-flash',
		`System ${'workspace context '.repeat(10_000)}`,
		[{ role: 'user', content: 'Use the right tool.' }],
		tools,
		new AbortController().signal,
		{},
		{ stream: modelStream } as ModelTurnStream
	);
	for await (const event of events) void event;

	expect(modelStream).toHaveBeenCalledTimes(1);
	expect(modelStream.mock.calls[0][0].tools.map((tool) => tool.name)).toEqual(
		tools.map((tool) => tool.name)
	);
	expect(modelStream.mock.calls[0][0].maxTokens).toBe(32_768);
});
