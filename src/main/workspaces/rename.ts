import { workspaceName } from './name';
import { readWorkspaces } from './read';
import { writeWorkspaces } from './write';

export function renameWorkspace(id: string, name: string): void {
	const records = readWorkspaces();
	const record = records.find((entry) => entry.id === id);
	if (!record) throw new Error('Workspace not found.');
	record.name = workspaceName(
		name,
		records.filter((entry) => entry !== record)
	);
	writeWorkspaces(records);
}
