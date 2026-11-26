import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { seal } from '../../vault/seal';
import { isUuid } from './session_is_uuid';
import { legacyFilePath } from './session_legacy_file_path';
import { messagesBackupFile } from './session_messages_backup_file';
import { messagesFile } from './session_messages_file';
import { sessionFolderName } from './session_session_folder_name';
import { sessionPath } from './session_session_path';
import type { SessionCoordinator } from './coordinator';
import { writeMessagesFile } from './session_write_messages';

export function clearMessagesBySessionId(
	sessionId: string,
	root: string,
	coordinator?: SessionCoordinator
): void {
	if (isUuid(sessionId)) coordinator?.invalidate(messagesFile(root, sessionId));
	const currentPath = isUuid(sessionId) ? messagesFile(root, sessionId) : undefined;
	const filePath =
		currentPath && existsSync(currentPath) ? currentPath : legacyFilePath(root, sessionId);
	if (!existsSync(filePath)) return;
	if (isUuid(sessionId)) {
		const backupPath = messagesBackupFile(root, sessionId);
		writeMessagesFile(filePath, backupPath, '[]\n');
		writeFileSync(backupPath, seal('[]\n'));
		const attachmentsPath = sessionPath(root, sessionFolderName(sessionId), 'attachments');
		if (existsSync(attachmentsPath)) rmSync(attachmentsPath, { recursive: true, force: true });
		rmSync(sessionPath(root, sessionFolderName(sessionId), 'modes'), {
			recursive: true,
			force: true,
		});
	} else writeFileSync(filePath, seal('[]\n'));

	if (!isUuid(sessionId)) return;
	const runPath = sessionPath(root, sessionFolderName(sessionId), 'run.jsonl');
	if (existsSync(runPath)) writeFileSync(runPath, '', 'utf8');
}
