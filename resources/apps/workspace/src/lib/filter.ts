import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function filterWorkspaceEntries(
	entries: WorkspaceTreeEntry[],
	query: string
): WorkspaceTreeEntry[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return entries;
	return entries.flatMap((entry) => {
		const children = filterWorkspaceEntries(entry.children ?? [], normalizedQuery);
		return entry.name.toLowerCase().includes(normalizedQuery) || children.length > 0
			? [{ ...entry, children }]
			: [];
	});
}
