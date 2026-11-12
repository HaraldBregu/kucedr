import { persist } from './session_persist';
import type { SessionState } from './session_types';
import type { Message } from '../types';

export function addInternalMessage(state: SessionState, text: string): void {
	if (!text || (state.lease && !state.lease.active)) return;
	const message: Message = { role: 'user', content: [{ type: 'text', internal: true, text }] };
	state.messages.push(message);
	if (state.lease && state.pendingMessages) state.pendingMessages.push(message);
	else persist(state);
}
