import type { Message } from '../types';

export function pinnedSkillIds(messages: readonly Message[]): string[] {
	const stamped = messages.findLast((message) => message.skillIds?.length);
	if (stamped?.skillIds) return [...stamped.skillIds];
	const ids = new Set<string>();
	for (const message of messages) {
		if (!Array.isArray(message.content)) continue;
		for (const block of message.content) {
			if (block.kind !== 'skill' || typeof block.text !== 'string') continue;
			for (const match of block.text.matchAll(/<skill_content (\{[^\n]*?\})>/g)) {
				try {
					const id = (JSON.parse(match[1]) as { id?: unknown }).id;
					if (typeof id === 'string') ids.add(id);
				} catch {
					continue;
				}
			}
		}
	}
	return [...ids];
}
