import { rmSync } from 'node:fs';
import path from 'node:path';
import { session } from 'electron';
import { closeTab } from '../agent/tools/web/browser/close';
import { workspaceTabs } from '../agent/tools/web/browser/local';
import { deleteSchedule } from '../tasks/tasks_delete_schedule';
import { listSchedules } from '../tasks/tasks_list_schedules';
import { workspaceImages } from './images';
import { openedWorkspaces } from './opened';
import { readWorkspaces } from './read';
import { resolveWorkspace } from './resolve';
import { withinWorkspace } from './within';
import { writeWorkspaces } from './write';

export async function removeWorkspace(id: string): Promise<void> {
	const records = readWorkspaces();
	const record = records.find((entry) => entry.id === id);
	if (!record) throw new Error('Workspace not found.');
	const workspace = resolveWorkspace(id);
	withinWorkspace(id, () => {
		for (const schedule of listSchedules()) deleteSchedule(schedule.id);
		for (const tab of workspaceTabs()) closeTab(tab);
	});
	openedWorkspaces.delete(id);
	writeWorkspaces(records.filter((entry) => entry !== record));
	if (record.image && path.basename(record.image) === record.image)
		rmSync(path.join(workspaceImages(), record.image), { force: true });
	rmSync(workspace.browser, { recursive: true, force: true });
	rmSync(path.join(workspace.settings, `chat-${id}.json`), { force: true });
	rmSync(path.join(workspace.settings, `permissions-${id}.json`), { force: true });
	await session.fromPartition(workspace.partition).clearStorageData();
}
