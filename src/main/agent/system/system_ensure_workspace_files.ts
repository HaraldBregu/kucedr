import { existsSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../../shared/user_data_location';
import { BOOTSTRAP_FILE, USER_FILE, WORKSPACE_FILES } from './system_types';
import { ensureWorkspaceFile } from './system_ensure_workspace_file';
import { resolveWorkspacePath } from './system_resolve_workspace_path';

export function ensureWorkspaceFiles(workspacePath: string): void {
	// A missing USER.md marks a fresh workspace; BOOTSTRAP.md is only seeded then,
	// so deleting it after bootstrap completes is permanent.
	const isFirstRun =
		!existsSync(resolveWorkspacePath(workspacePath, USER_FILE)) &&
		!existsSync(path.join(userDataLocation(), 'user', 'USER.md'));
	for (const filePath of WORKSPACE_FILES) {
		if (filePath === BOOTSTRAP_FILE && !isFirstRun) continue;
		ensureWorkspaceFile(workspacePath, filePath);
	}
}
