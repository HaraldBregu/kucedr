import type { AgentHistoryContentBlock } from '../../../shared/agent_types';
import type { Message } from '../types';

export function toHistoryContentBlocks(message: Message): AgentHistoryContentBlock[] {
	const blocks = Array.isArray(message.content)
		? message.content
				.map((block): AgentHistoryContentBlock | undefined => {
					if (block.type === 'text' && typeof block.text === 'string') {
						return { type: 'text', text: block.text };
					}
					if (
						(block.type === 'text_file' ||
							block.type === 'image' ||
							block.type === 'document' ||
							block.type === 'file') &&
						typeof block.name === 'string' &&
						typeof block.mimeType === 'string'
					) {
						const bytes =
							typeof block.bytes === 'number'
								? block.bytes
								: typeof block.base64 === 'string'
									? Buffer.from(block.base64, 'base64').length
									: 0;
						return {
							type: 'attachment',
							kind:
								block.type === 'text_file' ? 'text' : block.type === 'image' ? 'image' : 'document',
							name: block.name,
							mimeType: block.mimeType,
							bytes,
							...(typeof block.path === 'string' ? { path: block.path } : {}),
						};
					}
					return undefined;
				})
				.filter((block): block is AgentHistoryContentBlock => block !== undefined)
		: [];

	for (const toolCall of message.toolCalls ?? []) {
		if (toolCall.name === 'tool_search') continue;
		blocks.push({
			type: 'tool_use',
			toolUseId: toolCall.id,
			toolName: toolCall.name,
			toolArgs: toolCall.args,
			...(typeof toolCall.durationMs === 'number' ? { durationMs: toolCall.durationMs } : {}),
		});
	}

	return blocks;
}
