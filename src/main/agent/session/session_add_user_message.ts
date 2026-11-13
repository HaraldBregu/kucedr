import type { MessageContent } from '../types';
import { persist } from './session_persist';
import type { SessionState } from './session_types';

export function addUserMessage(state: SessionState, content: MessageContent): void {
	if (state.lease && !state.lease.active) return;
	state.messages.push({ role: 'user', content, createdAtMs: Date.now() });
	persist(state);
}
