import { activate } from './tasks_activate';
import { unscheduleJob } from './tasks_unschedule_job';
import { update } from './tasks_update';
import type { TaskSchedule, TaskScheduleUpdateRequest } from './tasks_types';

export function updateSchedule(
	scheduleId: string,
	request: TaskScheduleUpdateRequest
): TaskSchedule {
	const now = new Date().toISOString();
	const patch: Partial<TaskSchedule> = { updatedAt: now };
	if (typeof request.name === 'string') patch.name = request.name.trim();
	if (typeof request.description === 'string') patch.description = request.description.trim();
	if (typeof request.cronExpression === 'string') {
		patch.cronExpression = request.cronExpression.trim().replace(/\s+/g, ' ');
	}
	if (typeof request.enabled === 'boolean') patch.enabled = request.enabled;
	if (typeof request.prompt === 'string') patch.prompt = request.prompt.trim();
	if (request.effort) patch.effort = request.effort;
	if (request.toolsAllow) patch.toolsAllow = request.toolsAllow;
	unscheduleJob(scheduleId);
	return activate(update(scheduleId, patch));
}
