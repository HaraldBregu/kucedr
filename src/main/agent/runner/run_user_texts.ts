import type { Message } from '../types';

export function userTexts(messages: readonly Message[]): string[] {
	return messages.flatMap((message) => {
		if (message.role !== 'user') return [];
		if (typeof message.content === 'string') return [message.content];
		return message.content.flatMap((block) =>
			block.type === 'text' && block.internal !== true && typeof block.text === 'string'
				? [block.text]
				: []
		);
	});
}
