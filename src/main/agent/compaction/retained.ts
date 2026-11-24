import { isInternalMessage } from '../runner/run_internal';
import type { Message } from '../types';

export function retainedUser(messages: Message[], automatic: boolean): number {
	const users = messages.flatMap((message, index) =>
		message.role === 'user' && !isInternalMessage(message) ? [index] : []
	);
	const keep = automatic ? Math.min(8, Math.ceil(users.length / 2)) : 8;
	return users.length > keep ? users[users.length - keep] : 0;
}
