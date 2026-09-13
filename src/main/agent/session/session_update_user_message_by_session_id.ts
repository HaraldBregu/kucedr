import { existsSync, readFileSync } from 'node:fs';
import { messagesBackupFile } from './session_messages_backup_file';
import { messagesFile } from './session_messages_file';
import { parseMessages } from './session_parse_messages';
import { sessionsRoot } from './session_sessions_root';
import { writeMessagesFile } from './session_write_messages';
import type { SessionCoordinator } from './coordinator';

export function updateUserMessageBySessionId(
	sessionId: string,
	location: string,
	userOffsetFromEnd: number,
	content: string,
	coordinator?: SessionCoordinator
): boolean {
	const root = sessionsRoot(location);
	const filePath = messagesFile(root, sessionId);
	const backupPath = messagesBackupFile(root, sessionId);

	for (const candidate of [filePath, backupPath]) {
		if (!existsSync(candidate)) continue;
		const messages = parseMessages(readFileSync(candidate, 'utf8'));
		if (!messages) continue;

		let remaining = userOffsetFromEnd;
		for (let index = messages.length - 1; index >= 0; index -= 1) {
			const message = messages[index];
			if (message.role !== 'user' || typeof message.content !== 'string') continue;
			if (remaining > 0) {
				remaining -= 1;
				continue;
			}

			coordinator?.invalidate(filePath);
			messages.splice(index, messages.length - index, { ...message, content });
			writeMessagesFile(filePath, backupPath, `${JSON.stringify(messages, null, '\t')}\n`);
			return true;
		}
	}

	return false;
}
