import { turnStart } from '../runner/run_turn_start';
import { loadMessages, resolveStoredSessionId, sessionFolderName } from '../session';
import { sessionPath } from '../session/session_session_path';
import { writeMessagesFile } from '../session/session_write_messages';
import type { Config } from '../types';
import type { AgentCompactSessionResult } from '../../../shared/agent_types';
import type { KeyedLimiter } from '../limiter';
import { retainedUser } from './retained';
import { summarize } from './summarize';

export async function compactConversation(
	config: Config,
	sessionId: string,
	providerLimiter: KeyedLimiter
): Promise<AgentCompactSessionResult> {
	const root = config.workspace.sessions;
	const resolvedSessionId = resolveStoredSessionId(sessionId, root);
	const messages = loadMessages(config, resolvedSessionId);
	const retainFrom = turnStart(messages, retainedUser(messages, false));
	if (retainFrom === 0)
		return { status: 'not_needed', retainedMessages: messages.length, removedMessages: 0 };

	const previous = messages.slice(0, retainFrom);
	const retained = messages.slice(retainFrom).map(({ compaction, ...message }) => message);
	const summary = await summarize(previous, resolvedSessionId, providerLimiter);
	if (!summary.trim()) throw new Error('Conversation compaction produced an empty summary.');

	const next = [{ role: 'summary' as const, content: summary.trim() }, ...retained];
	const root = sessionsRoot(config.location);
	const folder = sessionFolderName(resolvedSessionId);
	writeMessagesFile(
		sessionPath(root, folder, 'messages.json'),
		sessionPath(root, folder, 'messages.json.bak'),
		`${JSON.stringify(next, null, '\t')}\n`
	);
	return {
		status: 'compacted',
		retainedMessages: retained.length + 1,
		removedMessages: previous.length,
	};
}
