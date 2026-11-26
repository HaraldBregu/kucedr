import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { currentWorkspace } from '../workspaces/current';
import { requireSchedule } from './tasks_require_schedule';
import type { TaskSchedule } from './tasks_types';

export function getSchedule(scheduleId: string): TaskSchedule {
	const schedule = requireSchedule(scheduleId);
	if ((schedule.workspaceId ?? DEFAULT_WORKSPACE) !== currentWorkspace().id)
		throw new Error(`Task schedule not found: ${scheduleId}`);
	return schedule;
}
