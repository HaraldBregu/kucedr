import type { SessionState } from './session_types';
import { atomicWriteFile } from './session_atomic_write';
import { ensureSession } from './session_ensure_session';
import { sessionPath } from './session_session_path';

export function persistSystemPrompt(state: SessionState, systemPrompt: string): void {
	if (!state.sessionsPath || (state.lease && !state.lease.active)) return;
	ensureSession(state);
	atomicWriteFile(
		sessionPath(state.sessionsPath, state.folderName, 'SYSTEM.md'),
		`${systemPrompt}\n`
	);
}
