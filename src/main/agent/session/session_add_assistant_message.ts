import type { MessageContentBlock, ToolCall } from '../types';
import { persist } from './session_persist';
import type { SessionState, SessionUsage } from './session_types';
import { hasAssistantPayload } from './session_has_assistant_payload';

export function addAssistantMessage(
	state: SessionState,
	content: string,
	toolCalls: ToolCall[],
	providerItems: MessageContentBlock[] = [],
	usage?: SessionUsage
): void {
	if (state.lease && !state.lease.active) return;
	if (!hasAssistantPayload(content, toolCalls)) return;
	const contentBlocks: MessageContentBlock[] = [...providerItems];
	if (content || contentBlocks.length === 0) {
		contentBlocks.push({ type: 'text', text: content });
	}
	state.messages.push({
		role: 'assistant',
		content: contentBlocks,
		createdAtMs: Date.now(),
		...(toolCalls.length > 0 ? { toolCalls } : {}),
		...(usage ? { usage } : {}),
	});
	persist(state);
}
