import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function availableWorkspaceName(entries: WorkspaceTreeEntry[]): string {
	const names = new Set(entries.map((entry) => entry.name));
	let index = 1;
	let name = 'Untitled.md';
	while (names.has(name)) {
		index += 1;
		name = `Untitled ${index}.md`;
	}
	return name;
}
