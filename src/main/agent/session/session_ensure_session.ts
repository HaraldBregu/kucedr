import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { seal } from '../../vault/seal';
import type { SessionState } from './session_types';
import { infoFile } from './session_info_file';
import { messagesBackupFilePath } from './session_messages_backup_file_path';
import { messagesFilePath } from './session_messages_file_path';
import { runFilePath } from './session_run_file_path';
import { sessionDir } from './session_session_dir';
import { writeMessagesFile } from './session_write_messages';

export function ensureSession(state: SessionState): void {
	if (state.lease && !state.lease.active) throw new Error('Session writer is no longer active.');
	mkdirSync(sessionDir(state), { recursive: true });
	const infoPath = infoFile(state.sessionsPath, state.id);
	if (!existsSync(infoPath))
		writeFileSync(infoPath, `${JSON.stringify({ type: state.category })}\n`, 'utf8');
	if (!existsSync(messagesFilePath(state)))
		writeMessagesFile(messagesFilePath(state), messagesBackupFilePath(state), '[]\n');
	if (!existsSync(runFilePath(state))) writeFileSync(runFilePath(state), '', 'utf8');
}
