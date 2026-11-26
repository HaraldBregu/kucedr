import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../types';
import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import { ensureWorkspaceFiles } from './system_ensure_workspace_files';

export function workspacePath(config: Config): string {
	const resolvedPath = path.resolve(config.location);
	if (config.workspace.id !== DEFAULT_WORKSPACE) return resolvedPath;
	if (!existsSync(resolvedPath)) {
		mkdirSync(resolvedPath, { recursive: true });
	}
	ensureWorkspaceFiles(resolvedPath);
	return resolvedPath;
}
