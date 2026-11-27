import { readdirSync } from 'node:fs';
import { isUuid } from '../agent/session/session_is_uuid';
import { sessionWorkspace } from '../agent/session/session_session_workspace';

export function workspaceSessions(root: string, workspace: string): string[] {
	try {
		return readdirSync(root, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() && isUuid(entry.name) && sessionWorkspace(root, entry.name) === workspace
			)
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}
