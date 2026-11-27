import type { AgentHistoryMessage } from '../../../shared/agent_types';
import type { Message } from '../types';
import { toHistoryContentBlocks } from './session_to_history_content_blocks';
import { toTextContent } from './session_to_text_content';
import { unwrap } from './unwrap';

export function toHistoryMessages(message: Message): AgentHistoryMessage[] {
	if (message.role === 'system') return [];
	if (
		Array.isArray(message.content) &&
		message.content.length > 0 &&
		message.content.every((block) => block.internal === true)
	)
		return [];

	const content = toTextContent(message.content);
	if (message.role === 'summary') return [{ role: 'summary', content }];

	if (message.role === 'assistant') {
		const messages: AgentHistoryMessage[] = [
			{
				role: 'assistant',
				content,
				...(message.runId ? { runId: message.runId } : {}),
				...(message.createdAtMs !== undefined ? { createdAtMs: message.createdAtMs } : {}),
				contentBlocks: toHistoryContentBlocks(message),
				...(message.usage ? { usage: message.usage } : {}),
				...(message.modeIds ? { modeIds: message.modeIds } : {}),
				...(message.skillIds ? { skillIds: message.skillIds } : {}),
			},
		];
		for (const toolCall of message.toolCalls ?? []) {
			if (toolCall.name === 'tool_search') continue;
			if (!toolCall.result) continue;
			const output = unwrap(toTextContent(toolCall.result.content));
			const isError = toolCall.result.isError ?? output.startsWith('Error:');
			messages.push({
				role: 'tool',
				content: output,
				toolUseId: toolCall.id,
				isError,
				status: isError ? 'error' : 'ok',
				output,
			});
		}
		return messages;
	}

	return [
		{
			role: 'user',
			content,
			...(message.compaction ? { compaction: message.compaction } : {}),
			...(message.createdAtMs !== undefined ? { createdAtMs: message.createdAtMs } : {}),
			...(message.followUp ? { followUp: true } : {}),
			contentBlocks: toHistoryContentBlocks(message),
		},
	];
}
