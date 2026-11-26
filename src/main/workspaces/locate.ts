import { workspaceFolder } from './folder';
import { readWorkspaces } from './read';
import { writeWorkspaces } from './write';

export function locateWorkspace(id: string, folder: string): void {
	const records = readWorkspaces();
	const record = records.find((entry) => entry.id === id);
	if (!record) throw new Error('Workspace not found.');
	record.folder = workspaceFolder(folder, id);
	writeWorkspaces(records);
}
