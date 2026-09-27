import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function findWorkspaceEntry(
	entries: WorkspaceTreeEntry[],
	filePath: string | null
): WorkspaceTreeEntry | null {
	if (!filePath) return null;
	for (const entry of entries) {
		if (entry.path === filePath) return entry;
		const child = entry.children ? findWorkspaceEntry(entry.children, filePath) : null;
		if (child) return child;
	}
	return null;
}
