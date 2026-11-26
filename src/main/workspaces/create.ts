import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { WorkspaceRecord } from '../../shared/workspaces_types';
import { DEFAULT_WORKSPACE_NAME } from '../../shared/workspaces_types';
import { workspaceFolder } from './folder';
import { readWorkspaces } from './read';
import { writeWorkspaces } from './write';

export function createWorkspace(folder: string): WorkspaceRecord {
	const real = workspaceFolder(folder);
	const records = readWorkspaces();
	const taken = new Set(
		[DEFAULT_WORKSPACE_NAME, ...records.map((record) => record.name)].map((name) =>
			name.toLowerCase()
		)
	);
	const base = (path.basename(real).trim() || 'Workspace').slice(0, 60);
	let name = base;
	for (let count = 2; taken.has(name.toLowerCase()); count += 1) name = `${base} ${count}`;
	const record: WorkspaceRecord = { id: randomUUID(), name, folder: real };
	writeWorkspaces([...records, record]);
	return record;
}
