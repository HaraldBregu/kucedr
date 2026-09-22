import type { Message, ToolCall } from '../types';
import { hasAssistantPayload } from './session_has_assistant_payload';

export const EXPIRED_SKILL_CONTEXT =
	'Skill instructions omitted because they applied only to the run that loaded them.';

export function sanitizeMessages(messages: Message[]): Message[] {
	const sanitized: Message[] = [];
	for (const message of messages) {
		if (
			message.role === 'assistant' &&
			!hasAssistantPayload(message.content, message.toolCalls)
		)
			continue;
		if (message.role !== 'assistant' || !message.toolCalls?.length) {
			sanitized.push(message);
			continue;
		}

		let changed = false;
		const toolCalls: ToolCall[] = [];
		for (const toolCall of message.toolCalls) {
			if (
				toolCall.name !== 'load_skill' ||
				!toolCall.result ||
				toolCall.result.isError ||
				(typeof toolCall.result.content === 'string' &&
					toolCall.result.content.includes('"activated":true'))
			) {
				toolCalls.push(toolCall);
				continue;
			}
			changed = true;
			toolCalls.push({
				...toolCall,
				result: { ...toolCall.result, content: EXPIRED_SKILL_CONTEXT },
			});
		}
		sanitized.push(changed ? { ...message, toolCalls } : message);
	}
	return sanitized;
}
