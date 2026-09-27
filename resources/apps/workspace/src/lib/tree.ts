import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function collectDirectoryPaths(
	entries: WorkspaceTreeEntry[],
	paths = new Set<string>()
): Set<string> {
	for (const entry of entries) {
		if (entry.type !== 'directory') continue;
		paths.add(entry.path);
		if (entry.children) collectDirectoryPaths(entry.children, paths);
	}
	return paths;
}
