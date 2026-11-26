import type { WorkspaceRecord } from '../../shared/workspaces_types';
import { DEFAULT_WORKSPACE_NAME } from '../../shared/workspaces_types';

export function workspaceName(name: string, others: readonly WorkspaceRecord[]): string {
	const trimmed = name.trim();
	if (!trimmed || trimmed.length > 64) throw new Error('A workspace name has 1 to 64 characters.');
	const taken = [DEFAULT_WORKSPACE_NAME, ...others.map((record) => record.name)].map((entry) =>
		entry.toLowerCase()
	);
	if (taken.includes(trimmed.toLowerCase()))
		throw new Error(`A workspace named "${trimmed}" already exists.`);
	return trimmed;
}
