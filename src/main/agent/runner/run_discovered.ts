import type { Message } from '../types';
import { TOOL_SEARCH_ID } from './run_discovery';

export function discoveredToolIds(messages: readonly Message[]): string[] {
	const ids = messages.flatMap((message) =>
		(message.toolCalls ?? []).flatMap((call) => {
			if (call.name !== TOOL_SEARCH_ID || typeof call.result?.content !== 'string') return [];
			try {
				const selected = (JSON.parse(call.result.content) as { selectedToolIds?: unknown })
					.selectedToolIds;
				return Array.isArray(selected)
					? selected.filter((id): id is string => typeof id === 'string')
					: [];
			} catch {
				return [];
			}
		})
	);
	return [...new Set(ids)];
}
