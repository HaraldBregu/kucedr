import OpenAI from 'openai';
import type {
	FunctionTool,
	ResponseCreateParamsNonStreaming,
} from 'openai/resources/responses/responses';
import type { LlmProviderEvent, LlmStreamRequest } from './llm_types';
import { llmBuildResponseInput, llmHasFunctionCall, llmIsRecord } from './llm_shared';

export async function* responses(
	client: OpenAI,
	req: LlmStreamRequest
): AsyncIterable<LlmProviderEvent> {
	const tools: FunctionTool[] = req.tools.map((tool) => ({
		type: 'function',
		name: tool.name,
		description: tool.description,
		parameters: tool.schema as Record<string, unknown>,
		strict: false,
	}));
	const responseOptions = req.options as Partial<ResponseCreateParamsNonStreaming> | undefined;
	const configuredReasoning = responseOptions?.reasoning;
	const response = await client.responses.create(
		{
			...responseOptions,
			model: req.model,
			instructions: req.system || undefined,
			input:
				(req.inputItems as ResponseCreateParamsNonStreaming['input']) ??
				llmBuildResponseInput(req.messages),
			previous_response_id: req.previousResponseId,
			tools: tools.length > 0 ? tools : undefined,
			reasoning: req.effort
				? { ...(configuredReasoning ?? {}), effort: req.effort }
				: configuredReasoning,
			max_output_tokens: req.maxTokens,
			include: ['reasoning.encrypted_content'],
			stream: false,
		},
		{ signal: req.signal }
	);

	yield { type: 'message_start' };
	yield { type: 'response_created', id: response.id };
	for (const item of response.output) {
		if (item.type === 'message') {
			for (const content of item.content) {
				if (content.type === 'output_text' && content.text) {
					yield { type: 'text_delta', text: content.text };
				}
				if (content.type === 'refusal' && content.refusal) {
					yield { type: 'text_delta', text: content.refusal };
				}
			}
			continue;
		}
		if (item.type === 'reasoning') {
			yield { type: 'reasoning_item', provider: 'openai', item };
			continue;
		}
		if (item.type === 'function_call') {
			yield { type: 'tool_call_start', id: item.call_id, name: item.name };
			if (item.arguments) {
				yield { type: 'tool_call_args_delta', id: item.call_id, jsonDelta: item.arguments };
			}
			yield { type: 'tool_call_end', id: item.call_id };
			continue;
		}
		if (item.type === 'mcp_approval_request') {
			yield {
				type: 'mcp_approval_request',
				id: item.id,
				serverLabel: item.server_label,
				name: item.name,
				arguments: item.arguments,
				item,
			};
			continue;
		}
		if (item.type === 'mcp_list_tools') {
			yield {
				type: 'mcp_list_tools',
				serverLabel: item.server_label,
				item,
				tools: item.tools.map((tool) => ({
					name: tool.name,
					description: tool.description ?? undefined,
					inputSchema: llmIsRecord(tool.input_schema) ? tool.input_schema : undefined,
				})),
			};
			continue;
		}
		if (item.type === 'mcp_call') {
			yield {
				type: 'mcp_call',
				id: item.id,
				serverLabel: item.server_label,
				name: item.name,
				arguments: item.arguments,
				output: item.output ?? undefined,
				error: item.error ?? undefined,
				status: item.status,
				item,
			};
		}
	}

	if (response.status === 'failed')
		throw new Error(response.error?.message ?? 'OpenAI response failed.');
	const stopReason =
		response.status === 'incomplete'
			? response.incomplete_details?.reason === 'max_output_tokens'
				? 'max_tokens'
				: 'incomplete'
			: llmHasFunctionCall(response.output)
				? 'tool_calls'
				: 'end_turn';
	yield {
		type: 'message_end',
		stopReason,
		usage: {
			inputTokens: response.usage?.input_tokens ?? 0,
			outputTokens: response.usage?.output_tokens ?? 0,
		},
	};
}
