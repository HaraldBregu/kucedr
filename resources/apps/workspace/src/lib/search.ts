import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function searchWorkspaceEntries(
	entries: WorkspaceTreeEntry[],
	query: string
): WorkspaceTreeEntry[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) return [];
	const matches: WorkspaceTreeEntry[] = [];
	const pending = [...entries].reverse();
	while (pending.length > 0) {
		const entry = pending.pop();
		if (!entry) continue;
		if (entry.name.toLowerCase().includes(normalizedQuery)) matches.push(entry);
		pending.push(...(entry.children ?? []).slice().reverse());
	}
	return matches;
}
