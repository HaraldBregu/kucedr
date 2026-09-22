import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import type { AgentSessionSummary } from '../../../shared/agent_types';
import type { SessionCategory } from './session_types';
import { DEFAULT_CATEGORY } from './session_types';
import { infoFile } from './session_info_file';
import { isUuid } from './session_is_uuid';
import { loadMessagesBySessionId } from './session_load_messages_by_session_id';
import { sessionPath } from './session_session_path';
import { sessionType } from './session_session_type';
import { sessionsRoot } from './session_sessions_root';

function sessionTitle(sessionId: string, location: string): string {
	try {
		const info = JSON.parse(readFileSync(infoFile(sessionsRoot(location), sessionId), 'utf8')) as {
			title?: unknown;
		};
		if (typeof info.title === 'string' && info.title.trim()) return info.title.trim();
	} catch {
		void 0;
	}
	const firstUserMessage = loadMessagesBySessionId(sessionId, location).find(
		(message) => message.role === 'user'
	);
	if (!firstUserMessage) return '';
	const text =
		typeof firstUserMessage.content === 'string'
			? firstUserMessage.content
			: firstUserMessage.content
					.map((block) =>
						block.type === 'text' && typeof block.text === 'string' ? block.text : ''
					)
					.filter(Boolean)
					.join(' ');
	return text.trim().replace(/\s+/g, ' ').slice(0, 60);
}

export function listSessions(
	location: string,
	category: SessionCategory = DEFAULT_CATEGORY
): AgentSessionSummary[] {
	const root = sessionsRoot(location);
	if (!existsSync(root)) return [];
	try {
		return readdirSync(root, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() && isUuid(entry.name) && sessionType(root, entry.name) === category
			)
			.map((entry) => {
				const stats = statSync(sessionPath(root, entry.name));
				return {
					id: entry.name,
					createdAtMs: stats.birthtimeMs || stats.ctimeMs || stats.mtimeMs,
					title: sessionTitle(entry.name, location),
					category,
				};
			})
			.sort((a, b) => b.createdAtMs - a.createdAtMs || b.id.localeCompare(a.id));
	} catch {
		return [];
	}
}
