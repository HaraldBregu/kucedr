import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function removeWorkspaceEntry(
	entries: WorkspaceTreeEntry[],
	filePath: string
): WorkspaceTreeEntry[] {
	return entries
		.filter((entry) => entry.path !== filePath)
		.map((entry) =>
			entry.children
				? { ...entry, children: removeWorkspaceEntry(entry.children, filePath) }
				: entry
		);
}
