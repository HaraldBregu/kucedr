import type { Config } from '../types';
import type { Message } from '../types';
import { loadMessagesBySessionId } from './session_load_messages_by_session_id';
import { resolveStoredSessionId } from './session_resolve_stored_session_id';

export function loadMessages(config: Config, sessionId: string): Message[] {
	const resolvedSessionId = resolveStoredSessionId(sessionId, config.workspace.sessions);
	return loadMessagesBySessionId(resolvedSessionId, config.workspace.sessions);
}
