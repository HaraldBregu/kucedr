import Anthropic from '@anthropic-ai/sdk';
import type { LlmProviderEvent, LlmStreamRequest } from './llm_types';
import { llmBuildAnthropicMessages } from './llm_shared';

export async function* anthropic(
	client: Anthropic,
	req: LlmStreamRequest
): AsyncIterable<LlmProviderEvent> {
	const tools: Anthropic.Messages.Tool[] = req.tools.map((tool) => ({
		name: tool.name,
		description: tool.description,
		input_schema: tool.schema as Anthropic.Messages.Tool.InputSchema,
		...(tool.inputExamples?.length ? { input_examples: [...tool.inputExamples] } : {}),
	}));
	const response = await client.messages.create(
		{
			...req.options,
			model: req.model,
			system: req.system,
			max_tokens: req.maxTokens,
			tools: tools.length > 0 ? tools : undefined,
			messages: llmBuildAnthropicMessages(req.messages),
			stream: false,
		},
		{ signal: req.signal }
	);

	yield { type: 'message_start' };
	for (const block of response.content) {
		if (block.type === 'text' && block.text) {
			yield { type: 'text_delta', text: block.text };
			continue;
		}
		if (block.type === 'tool_use') {
			yield { type: 'tool_call_start', id: block.id, name: block.name };
			yield {
				type: 'tool_call_args_delta',
				id: block.id,
				jsonDelta: JSON.stringify(block.input ?? {}),
			};
			yield { type: 'tool_call_end', id: block.id };
		}
	}
	yield {
		type: 'message_end',
		stopReason: response.stop_reason ?? 'end_turn',
		usage: {
			inputTokens: response.usage.input_tokens,
			outputTokens: response.usage.output_tokens,
		},
	};
}
