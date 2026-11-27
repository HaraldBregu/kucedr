import type { SessionCoordinator } from './coordinator';
import type { Config } from '../types';
import { clearMessagesBySessionId } from './session_clear_messages_by_session_id';
import { resolveStoredSessionId } from './session_resolve_stored_session_id';
import type { SessionState } from './session_types';

export function clearMessages(
	state: SessionState,
	config: Config,
	sessionId: string,
	coordinator?: SessionCoordinator
): void {
	const resolvedSessionId = resolveStoredSessionId(
		sessionId,
		config.workspace.sessions,
		'main',
		config.workspace.id
	);
	clearMessagesBySessionId(resolvedSessionId, config.workspace.sessions, coordinator);
	if (state.id === resolvedSessionId) state.messages = [];
}
