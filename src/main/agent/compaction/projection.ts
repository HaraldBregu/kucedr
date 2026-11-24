import { turnStart } from '../runner/run_turn_start';
import { expandRunContext } from '../session/session_expand_run_context';
import type { Message } from '../types';

export function projectHistory(messages: Message[]): Message[] {
	const anchor = messages.findLastIndex((message) =>
		message.role === 'user' && typeof message.compaction?.summary === 'string' &&
		message.compaction.summary.trim().length > 0
	);
	if (anchor < 0) return messages;
	const start = turnStart(messages, anchor);
	return [
		{ role: 'summary', content: messages[anchor].compaction!.summary },
		...expandRunContext(messages.slice(0, start), messages.slice(start)),
	];
}
