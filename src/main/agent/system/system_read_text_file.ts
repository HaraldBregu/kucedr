import fs from 'node:fs/promises';
import type { WorkspaceFile } from './system_types';
import { resolveWorkspacePath } from './system_resolve_workspace_path';

export async function readTextFile(workspacePath: string, filePath: WorkspaceFile): Promise<string> {
	try {
		return await fs.readFile(resolveWorkspacePath(workspacePath, filePath), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
		throw error;
	}
}
