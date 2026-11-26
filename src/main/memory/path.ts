import path from 'node:path';
import type { Workspace } from '../workspaces/types';

export const MEMORY_FILE = 'MEMORY.md';
export const MEMORY_SETTINGS_FILE = 'settings.json';

export function memoryPath(workspace: Workspace): string {
	return path.join(workspace.memory, MEMORY_FILE);
}
