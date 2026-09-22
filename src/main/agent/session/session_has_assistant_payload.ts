import type { MessageContent, ToolCall } from '../types';

export function hasAssistantPayload(content: MessageContent, toolCalls?: ToolCall[]): boolean {
	if ((toolCalls?.length ?? 0) > 0) return true;
	if (typeof content === 'string') return content.trim().length > 0;
	return content.some(
		(block) => block.type === 'text' && typeof block.text === 'string' && block.text.trim().length > 0
	);
}
