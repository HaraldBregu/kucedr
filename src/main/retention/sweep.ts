import type { AgentSessionSummary } from '../../shared/agent_types';
import { getChatRetention } from './state';

interface Sessions {
	listSessions(category: 'all'): AgentSessionSummary[];
	deleteSession(sessionId: string): Promise<void>;
}

// ponytail: sweeps the active workspace only; others are swept on the hourly run after they become active.
export async function sweepChats(sessions: Sessions, now = Date.now()): Promise<number> {
	const days = getChatRetention();
	if (!days) return 0;
	const cutoff = now - days * 24 * 60 * 60 * 1000;
	const expired = sessions
		.listSessions('all')
		.filter((session) => !session.pinned && !session.runStatus && (session.updatedAtMs ?? session.createdAtMs) < cutoff);
	for (const session of expired) await sessions.deleteSession(session.id);
	return expired.length;
}
