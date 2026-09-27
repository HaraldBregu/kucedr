import type { WorkspaceTreeEntry } from '@kucedr/sdk';

export function workspaceMoveError(
	source: WorkspaceTreeEntry,
	destinationPath: string,
	destinationEntries: WorkspaceTreeEntry[]
): string {
	const normalizedSourcePath = source.path.replaceAll('\\', '/');
	const normalizedDestinationPath = destinationPath.replaceAll('\\', '/');
	const separatorIndex = normalizedSourcePath.lastIndexOf('/');
	const sourceParentPath =
		separatorIndex === -1 ? '' : normalizedSourcePath.slice(0, separatorIndex);
	if (sourceParentPath === normalizedDestinationPath) return 'The item is already in this folder.';
	if (
		source.type === 'directory' &&
		(normalizedDestinationPath === normalizedSourcePath ||
			normalizedDestinationPath.startsWith(`${normalizedSourcePath}/`))
	) {
		return 'A folder cannot be moved into itself.';
	}
	if (
		destinationEntries.some((entry) => entry.name === source.name && entry.path !== source.path)
	) {
		return `An item named "${source.name}" already exists here.`;
	}
	return '';
}
