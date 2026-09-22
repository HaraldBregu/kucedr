import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type {
	ResponseInput,
	ResponseInputContent,
	ResponseInputItem,
	ResponseOutputItem,
} from 'openai/resources/responses/responses';
import type { Message } from '../../../agent/types';
import { hasAssistantPayload } from '../../../agent/session/session_has_assistant_payload';
import { formatUploadedTextFile } from '../../../agent/attachments/text';
import type {
	LlmContentBlock,
	LlmStreamRequest,
	LlmTranscriptEntry,
	LlmUserContentBlock,
} from './llm_types';

type ReasoningContentBlock = Extract<LlmContentBlock, { type: 'reasoning' }>;

const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export type LlmChatContentProfile = 'image-only' | 'reka';

export function llmToTranscriptEntry(message: Message): LlmTranscriptEntry[] {
	if (message.role === 'assistant') {
		if (!hasAssistantPayload(message.content, message.toolCalls)) return [];
		const content = toAssistantContent(message.content);
		for (const toolCall of message.toolCalls ?? []) {
			content.push({
				type: 'tool_use',
				toolUseId: toolCall.id,
				toolName: toolCall.name,
				toolArgs: toolCall.args,
			});
		}
		const entries: LlmTranscriptEntry[] = [{ role: 'assistant', content }];
		for (const toolCall of message.toolCalls ?? []) {
			// Providers reject assistant tool_calls without a matching tool message,
			// so a missing result (cancelled or interrupted run) becomes an error reply.
			const result = toolCall.result ?? {
				content: 'Error: tool call was cancelled before it completed',
				isError: true,
			};
			entries.push({
				role: 'tool',
				toolUseId: toolCall.id,
				content: [{ type: 'text', text: toTextContent(result.content) }],
				isError: result.isError,
				status: result.isError ? 'error' : 'ok',
			});
		}
		return entries;
	}
	return [{ role: 'user', content: toUserContent(message.content) }];
}

function toUserContent(content: Message['content']): string | LlmUserContentBlock[] {
	if (typeof content === 'string') return content;
	const blocks = content
		.map((block): LlmUserContentBlock | undefined => {
			if (block.type === 'text' && typeof block.text === 'string')
				return { type: 'text', text: block.text };
			if (
				block.type === 'text_file' &&
				typeof block.name === 'string' &&
				typeof block.mimeType === 'string' &&
				typeof block.bytes === 'number' &&
				typeof block.text === 'string'
			) {
				return {
					type: 'text',
					text: formatUploadedTextFile(block.text),
				};
			}
			if (block.type === 'image' && typeof block.base64 === 'string') {
				const mimeType = requireSupportedImageMimeType(block.mimeType, 'image attachment');
				return {
					type: 'image',
					mimeType,
					base64: block.base64,
				};
			}
			if (
				(block.type === 'document' || block.type === 'file') &&
				typeof block.base64 === 'string'
			) {
				const name = typeof block.name === 'string' ? block.name : 'unnamed attachment';
				if (block.mimeType !== 'application/pdf') {
					throw new Error(`${name}: only PDF document attachments can be serialized.`);
				}
				return {
					type: 'document',
					name,
					mimeType: 'application/pdf',
					base64: block.base64,
				};
			}
			throw new Error(`Unsupported user content block: ${String(block.type)}.`);
		})
		.filter((block): block is LlmUserContentBlock => block !== undefined);
	if (content.some((block) => block.type === 'text_file')) return blocks;
	if (blocks.every((block) => block.type === 'text')) return toTextContent(content);
	return blocks;
}

function toDataUrl(mimeType: string, base64: string): string {
	return `data:${mimeType};base64,${base64}`;
}

function requireSupportedImageMimeType(value: unknown, label: string): string {
	if (typeof value !== 'string' || !SUPPORTED_IMAGE_MIME_TYPES.has(value)) {
		throw new Error(`${label}: unsupported image MIME type ${String(value)}.`);
	}
	return value;
}

function requirePdfDocument(block: Extract<LlmUserContentBlock, { type: 'document' }>): void {
	if (block.mimeType !== 'application/pdf') {
		throw new Error(`${block.name}: only application/pdf documents can be serialized.`);
	}
}

function toAssistantContent(content: Message['content']): LlmContentBlock[] {
	if (typeof content === 'string') return content ? [{ type: 'text', text: content }] : [];
	return content
		.map((block): LlmContentBlock | undefined => {
			if (block.type === 'text' && typeof block.text === 'string')
				return { type: 'text', text: block.text };
			if (block.type === 'provider_item' && block.provider === 'openai') {
				return { type: 'provider_item', provider: 'openai', item: block.item };
			}
			return undefined;
		})
		.filter((block): block is LlmContentBlock => block !== undefined);
}

function toTextContent(content: Message['content']): string {
	if (typeof content === 'string') return content;
	return content
		.map((block) => (block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
		.filter(Boolean)
		.join('\n');
}

export function llmParseToolArgs(argsText: string): Record<string, unknown> {
	if (!argsText.trim()) return {};
	try {
		const parsed = JSON.parse(argsText);
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>;
		}
		return { __parsed: parsed };
	} catch {
		return { __unparsed: argsText };
	}
}

function toolResultText(entry: Extract<LlmTranscriptEntry, { role: 'tool' }>): string {
	return entry.content.map((c) => (c.type === 'text' ? c.text : '[binary content]')).join('\n');
}

function isOpenAIReasoningBlock(
	block: LlmContentBlock
): block is ReasoningContentBlock & { provider: 'openai' } {
	return block.type === 'reasoning' && block.provider === 'openai';
}

function isDeepSeekReasoningBlock(block: LlmContentBlock): block is ReasoningContentBlock {
	return block.type === 'reasoning' && block.provider === 'deepseek';
}

function asResponseInputItem(value: unknown): ResponseInputItem | null {
	if (typeof value !== 'object' || value === null) return null;
	const type = (value as { type?: unknown }).type;
	return type === 'reasoning' ||
		type === 'mcp_list_tools' ||
		type === 'mcp_call' ||
		type === 'mcp_approval_request' ||
		type === 'mcp_approval_response'
		? (value as ResponseInputItem)
		: null;
}

export function llmBuildResponseInput(transcript: LlmTranscriptEntry[]): ResponseInput {
	const input: ResponseInput = [];

	for (const entry of transcript) {
		if (entry.role === 'user') {
			input.push({ role: 'user', content: toResponseUserContent(entry.content) });
			continue;
		}

		if (entry.role === 'assistant') {
			const text = entry.content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('');
			const hasToolUse = entry.content.some((block) => block.type === 'tool_use');

			for (const block of entry.content) {
				const item =
					isOpenAIReasoningBlock(block) || block.type === 'provider_item'
						? asResponseInputItem(block.item)
						: null;
				if (item) input.push(item);
			}

			if (text) {
				input.push({
					type: 'message',
					role: 'assistant',
					content: text,
					phase: hasToolUse ? 'commentary' : 'final_answer',
				});
			}

			for (const block of entry.content) {
				if (block.type !== 'tool_use') continue;
				input.push({
					type: 'function_call',
					call_id: block.toolUseId,
					name: block.toolName,
					arguments: JSON.stringify(block.toolArgs ?? {}),
				});
			}
			continue;
		}

		input.push({
			type: 'function_call_output',
			call_id: entry.toolUseId,
			output: toolResultText(entry),
		});
	}

	return input;
}

function toResponseUserContent(
	content: string | LlmUserContentBlock[]
): string | ResponseInputContent[] {
	if (typeof content === 'string') return content;
	return content.map((block): ResponseInputContent => {
		if (block.type === 'text') return { type: 'input_text', text: block.text };
		if (block.type === 'image') {
			const mimeType = requireSupportedImageMimeType(block.mimeType, 'image attachment');
			return {
				type: 'input_image',
				image_url: toDataUrl(mimeType, block.base64),
				detail: 'auto',
			};
		}
		requirePdfDocument(block);
		return {
			type: 'input_file',
			filename: block.name,
			file_data: toDataUrl(block.mimeType, block.base64),
		};
	});
}

export function llmHasFunctionCall(output: ResponseOutputItem[] | undefined): boolean {
	return output?.some((item) => item.type === 'function_call') ?? false;
}

export function llmBuildAnthropicMessages(
	transcript: LlmTranscriptEntry[]
): Anthropic.Messages.MessageParam[] {
	const msgs: Anthropic.Messages.MessageParam[] = [];
	for (const entry of transcript) {
		if (entry.role === 'user') {
			msgs.push({ role: 'user', content: toAnthropicUserContent(entry.content) });
			continue;
		}
		if (entry.role === 'assistant') {
			const blocks: Array<
				Anthropic.Messages.TextBlockParam | Anthropic.Messages.ToolUseBlockParam
			> = [];
			for (const b of entry.content) {
				if (b.type === 'text' && b.text) {
					blocks.push({ type: 'text', text: b.text });
				} else if (b.type === 'tool_use') {
					blocks.push({
						type: 'tool_use',
						id: b.toolUseId,
						name: b.toolName,
						input: (b.toolArgs ?? {}) as Record<string, unknown>,
					});
				}
			}
			if (blocks.length === 0) blocks.push({ type: 'text', text: '' });
			msgs.push({ role: 'assistant', content: blocks });
			continue;
		}
		if (entry.role === 'tool') {
			const isError = entry.status ? entry.status !== 'ok' : entry.isError === true;
			const blocks: Anthropic.Messages.ToolResultBlockParam[] = [
				{
					type: 'tool_result',
					tool_use_id: entry.toolUseId,
					content: entry.content.map((c) =>
						c.type === 'text'
							? { type: 'text' as const, text: c.text }
							: {
									type: 'image' as const,
									source: {
										type: 'base64' as const,
										media_type: (c.mimeType ?? 'image/png') as
											| 'image/png'
											| 'image/jpeg'
											| 'image/gif'
											| 'image/webp',
										data: c.base64 ?? '',
									},
								}
					),
					is_error: isError ? true : undefined,
				},
			];
			msgs.push({ role: 'user', content: blocks });
		}
	}
	return msgs;
}

function toAnthropicUserContent(
	content: string | LlmUserContentBlock[]
): string | Anthropic.Messages.ContentBlockParam[] {
	if (typeof content === 'string') return content;
	return content.map((block): Anthropic.Messages.ContentBlockParam => {
		if (block.type === 'text') return { type: 'text', text: block.text };
		if (block.type === 'image') {
			const mimeType = requireSupportedImageMimeType(block.mimeType, 'image attachment');
			return {
				type: 'image',
				source: {
					type: 'base64',
					media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
					data: block.base64,
				},
			};
		}
		requirePdfDocument(block);
		return {
			type: 'document',
			source: { type: 'base64', media_type: block.mimeType, data: block.base64 },
		};
	});
}

export function llmBuildChatMessages(
	system: string,
	transcript: LlmTranscriptEntry[],
	options: { includeReasoningContent?: boolean; contentProfile?: LlmChatContentProfile } = {}
): OpenAI.ChatCompletionMessageParam[] {
	const msgs: OpenAI.ChatCompletionMessageParam[] = [];
	if (system) msgs.push({ role: 'system', content: system });

	for (const entry of transcript) {
		if (entry.role === 'user') {
			msgs.push({
				role: 'user',
				content: toChatUserContent(entry.content, options.contentProfile ?? 'image-only'),
			});
			continue;
		}
		if (entry.role === 'assistant') {
			const text = entry.content
				.filter((b): b is Extract<LlmContentBlock, { type: 'text' }> => b.type === 'text')
				.map((b) => b.text)
				.join('');
			const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = entry.content
				.filter((b): b is Extract<LlmContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
				.map((b) => ({
					id: b.toolUseId,
					type: 'function' as const,
					function: { name: b.toolName, arguments: JSON.stringify(b.toolArgs ?? {}) },
				}));
			const msg: OpenAI.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: text || null,
			};
			if (options.includeReasoningContent) {
				const reasoningContent = entry.content
					.filter(isDeepSeekReasoningBlock)
					.map((b) => (typeof b.item === 'string' ? b.item : ''))
					.join('');
				if (reasoningContent) {
					(
						msg as OpenAI.ChatCompletionAssistantMessageParam & { reasoning_content?: string }
					).reasoning_content = reasoningContent;
				}
			}
			if (toolCalls.length > 0) msg.tool_calls = toolCalls;
			msgs.push(msg);
			continue;
		}
		if (entry.role === 'tool') {
			const text = entry.content
				.map((c) => (c.type === 'text' ? c.text : '[binary content]'))
				.join('\n');
			msgs.push({ role: 'tool', tool_call_id: entry.toolUseId, content: text });
		}
	}

	return msgs;
}

function toChatUserContent(
	content: string | LlmUserContentBlock[],
	profile: LlmChatContentProfile
): string | OpenAI.ChatCompletionContentPart[] {
	if (typeof content === 'string') return content;
	return content.map((block): OpenAI.ChatCompletionContentPart => {
		if (block.type === 'text') return { type: 'text', text: block.text };
		if (block.type === 'image') {
			const mimeType = requireSupportedImageMimeType(block.mimeType, 'image attachment');
			return {
				type: 'image_url',
				image_url: { url: toDataUrl(mimeType, block.base64) },
			};
		}
		requirePdfDocument(block);
		if (profile !== 'reka') {
			throw new Error(`${block.name}: this chat adapter does not support document attachments.`);
		}
		return {
			type: 'pdf_url',
			pdf_url: { url: toDataUrl(block.mimeType, block.base64) },
		} as unknown as OpenAI.ChatCompletionContentPart;
	});
}

export function llmToDeepSeekReasoningEffort(
	effort: LlmStreamRequest['effort']
): 'high' | 'max' | undefined {
	if (!effort || effort === 'none') return undefined;
	if (effort === 'xhigh') return 'max';
	return 'high';
}

export function llmIsRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
