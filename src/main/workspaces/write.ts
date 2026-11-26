import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WorkspaceRecord } from '../../shared/workspaces_types';
import { workspacesFile } from './file';

export function writeWorkspaces(workspaces: WorkspaceRecord[]): void {
	const file = workspacesFile();
	mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	writeFileSync(`${file}.tmp`, `${JSON.stringify({ workspaces }, null, '\t')}\n`, { mode: 0o600 });
	renameSync(`${file}.tmp`, file);
}
