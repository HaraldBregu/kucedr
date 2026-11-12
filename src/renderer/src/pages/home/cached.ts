import type { HomeChatMessage } from './context/state';

export function cachedPercent(messages: readonly HomeChatMessage[]): {
	last?: number;
	session?: number;
} {
	let last: number | undefined;
	let cached = 0;
	let input = 0;
	for (const message of messages) {
		if (message.role !== 'agent' || message.cachedTokens === undefined || !message.inputTokens)
			continue;
		last = Math.min(100, Math.round((message.cachedTokens / message.inputTokens) * 100));
		cached += message.cachedTokens;
		input += message.inputTokens;
	}
	return {
		last,
		session: input ? Math.min(100, Math.round((cached / input) * 100)) : undefined,
	};
}
