import type { Message } from '../types';

export function isInternalMessage(message: Message): boolean {
	return (
		Array.isArray(message.content) &&
		message.content.length > 0 &&
		message.content.every((block) => block.internal === true)
	);
}
