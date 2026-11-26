import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { currentWorkspace } from '../workspaces/current';
import { list } from './tasks_list';
import type { TaskSchedule } from './tasks_types';

export function listSchedules(): TaskSchedule[] {
	const { id } = currentWorkspace();
	return list().filter((schedule) => (schedule.workspaceId ?? DEFAULT_WORKSPACE) === id);
}
