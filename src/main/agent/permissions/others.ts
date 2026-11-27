import { readdirSync } from 'node:fs';
import path from 'node:path';
import { isUuid } from '../session/session_is_uuid';
import { sessionWorkspace } from '../session/session_session_workspace';

// ponytail: reads every chat's info.json per check; cache by folder mtime if checks get slow
export function otherSessions(root: string, workspace: string): string[] {
	try {
		return readdirSync(root, { withFileTypes: true })
			.filter(
				(entry) =>
					entry.isDirectory() && isUuid(entry.name) && sessionWorkspace(root, entry.name) !== workspace
			)
			.map((entry) => path.join(root, entry.name));
	} catch {
		return [];
	}
}
