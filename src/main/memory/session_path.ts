import path from 'node:path';
import { isUuid } from '../agent/session/session_is_uuid';
import type { Workspace } from '../workspaces/types';

export function sessionMemoryPath(workspace: Workspace, sessionId: string): string {
	if (!isUuid(sessionId)) throw new Error('A valid memory session ID is required.');
	return path.join(workspace.memory, `${sessionId.toLowerCase()}.md`);
}
