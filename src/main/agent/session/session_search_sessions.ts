import { readdir, readFile, stat } from 'node:fs/promises';
import type { AgentSessionSearchResult } from '../../../shared/agent_types';
import { unseal } from '../../vault/unseal';
import { infoFile } from './session_info_file';
import { isUuid } from './session_is_uuid';
import { messagesFile } from './session_messages_file';
import { parseMessages } from './session_parse_messages';
import { sessionsRoot } from './session_sessions_root';
import { toHistoryMessages } from './session_to_history_messages';

export async function searchSessions(
	location: string,
	query: string
): Promise<AgentSessionSearchResult[]> {
	const needle = query.trim().toLowerCase();
	if (!needle) return [];
	const root = sessionsRoot(location);
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	// ponytail: reads and parses every chat on each query (about 30 ms for 88 chats / 11 MB); index with the knowledge store's SQLite once a query passes about 300 ms
	const results = await Promise.all(
		entries
			.filter((entry) => entry.isDirectory() && isUuid(entry.name))
			.map(async (entry): Promise<AgentSessionSearchResult | undefined> => {
				try {
					const file = messagesFile(root, entry.name);
					const [raw, stats, info] = await Promise.all([
						readFile(file, 'utf8'),
						stat(file),
						readFile(infoFile(root, entry.name), 'utf8')
							.then((text) => JSON.parse(text) as Record<string, unknown>)
							.catch((): Record<string, unknown> => ({})),
					]);
					if (['task', 'health', 'subagent', 'voice'].includes(info.type as string))
						return undefined;
					let next = 0;
					const messages = (parseMessages(raw) ?? [])
						.map((message) => {
							const position = next;
							next += toHistoryMessages(message).length;
							return { message, position };
						})
						.filter(({ message }) => message.role === 'user' || message.role === 'assistant')
						.map(({ message, position }) => ({
							role: message.role,
							position,
							text:
								typeof message.content === 'string'
									? message.content
									: message.content
											.map((block) =>
												block.type === 'text' &&
												typeof block.text === 'string' &&
												block.internal !== true
													? block.text
													: ''
											)
											.filter(Boolean)
											.join('\n'),
						}));
					const snippets: string[] = [];
					let position = 0;
					for (const { text, position: found } of messages) {
						const at = text.toLowerCase().indexOf(needle);
						if (at < 0) continue;
						if (snippets.length === 0) position = found;
						const start = Math.max(0, at - 24);
						snippets.push(
							(start > 0 ? '…' : '') +
								text
									.slice(start, at + needle.length + 96)
									.replace(/\s+/g, ' ')
									.trim()
						);
						if (snippets.length === 2) break;
					}
					if (snippets.length === 0) return undefined;
					const title =
						typeof info.title === 'string' && info.title.trim()
							? info.title.trim()
							: (messages.find((message) => message.role === 'user' && message.text.trim())?.text ?? '')
									.trim()
									.replace(/\s+/g, ' ')
									.slice(0, 60);
					return {
						id: entry.name,
						title,
						lastMessageAtMs: stats.mtimeMs,
						archived: info.archived === true,
						snippets,
						position,
					};
				} catch {
					return undefined;
				}
			})
	);
	return results
		.filter((result) => result !== undefined)
		.sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs)
		.slice(0, 50);
}
