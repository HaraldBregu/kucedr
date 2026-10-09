import OpenAI from 'openai';
import { content } from './content';
import type { ModelReasoningEffort } from '../../../../shared/agent_types';
import type { LlmProviderEvent, LlmStreamRequest } from './llm_types';
import { llmBuildChatMessages, llmToDeepSeekReasoningEffort } from './llm_shared';

export async function* chat(
	client: OpenAI,
	req: LlmStreamRequest,
	options: {
		reasoningContentEnabled: boolean;
		reasoningEffortEnabled: boolean;
		thinkingModeEnabled: boolean;
		contentProfile: 'image-only' | 'reka' | 'mistral';
	}
): AsyncIterable<LlmProviderEvent> {
	const tools: OpenAI.ChatCompletionTool[] = (req.model === 'reka-flash-3' ? [] : req.tools).map((tool) => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.schema as Record<string, unknown>,
		},
	}));
	const params: Record<string, unknown> = {
		...req.options,
		model: req.model,
		messages: llmBuildChatMessages(req.system, req.messages, {
			includeReasoningContent: options.reasoningContentEnabled,
			contentProfile: options.contentProfile,
		}),
		tools: tools.length > 0 ? tools : undefined,
		tool_choice: tools.length > 0 ? 'auto' : undefined,
		max_tokens: req.maxTokens,
		stream: false,
		stream_options: undefined,
	};
	if (options.thinkingModeEnabled) {
		params.thinking = { type: req.effort === 'none' ? 'disabled' : 'enabled' };
	}
	if (options.reasoningEffortEnabled) {
		const effort = llmToDeepSeekReasoningEffort(req.effort as ModelReasoningEffort | undefined);
		if (effort) params.reasoning_effort = effort;
	}
	const response = await client.chat.completions.create(
		params as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
		{ signal: req.signal }
	);
	const choice = response.choices[0];

	yield { type: 'message_start' };
	const text = content(choice?.message.content);
	if (text) yield { type: 'text_delta', text };
	if (options.contentProfile === 'mistral' && Array.isArray(choice?.message.content)) {
		for (const item of choice.message.content) yield { type: 'reasoning_item', provider: 'mistral', item };
	}
	const reasoningContent = (choice?.message as { reasoning_content?: unknown } | undefined)
		?.reasoning_content;
	if (
		options.reasoningContentEnabled &&
		typeof reasoningContent === 'string' &&
		reasoningContent.length > 0
	) {
		yield { type: 'reasoning_item', provider: 'deepseek', item: reasoningContent };
	}
	for (const toolCall of choice?.message.tool_calls ?? []) {
		if (toolCall.type !== 'function') continue;
		yield { type: 'tool_call_start', id: toolCall.id, name: toolCall.function.name };
		if (toolCall.function.arguments) {
			yield {
				type: 'tool_call_args_delta',
				id: toolCall.id,
				jsonDelta: toolCall.function.arguments,
			};
		}
		yield { type: 'tool_call_end', id: toolCall.id };
	}
	const stopReason =
		choice?.finish_reason === 'tool_calls'
			? 'tool_calls'
			: choice?.finish_reason === 'length'
				? 'max_tokens'
				: 'end_turn';
	yield {
		type: 'message_end',
		stopReason,
		usage: {
			inputTokens: response.usage?.prompt_tokens ?? 0,
			outputTokens: response.usage?.completion_tokens ?? 0,
		},
	};
}
