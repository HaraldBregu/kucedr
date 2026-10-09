import type { HomeChatMessage } from './context/state';

export function contextTokens(
	messages: readonly HomeChatMessage[],
	providerId: string,
	modelId: string,
	draft: string
): { tokens: number; estimated: boolean; contextWindow?: number; measured: boolean } {
	let tokens = 0;
	let estimated = true;
	let measured = false;
	let contextWindow: number | undefined;
	for (const message of messages) {
		if (message.id === 'agent-welcome') continue;
		const context = message.role === 'agent' ? message.contextUsage : undefined;
		if (context && context.providerId === providerId && context.modelId === modelId) {
			tokens = context.inputTokens + context.outputTokens;
			estimated = context.estimated;
			measured = true;
			contextWindow = context.contextWindow;
			if (message.role === 'agent' && message.streamedChars) {
				tokens += Math.ceil(message.streamedChars / 3);
				estimated = true;
			}
			continue;
		}
		const text = message.content + (message.role === 'agent' ? JSON.stringify(message.tools) : '');
		tokens += Math.ceil(new TextEncoder().encode(text).length / 3);
		estimated = true;
	}
	if (draft) {
		tokens += Math.ceil(new TextEncoder().encode(draft).length / 3);
		estimated = true;
	}
	return { tokens, estimated, contextWindow, measured };
}
