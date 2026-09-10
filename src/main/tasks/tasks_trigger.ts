import { requireSchedule } from './tasks_require_schedule';
import { buildTask } from './tasks_build_task';
import type { TaskScheduledTask } from './tasks_types';

export function trigger(scheduleId: string): TaskScheduledTask {
	const schedule = requireSchedule(scheduleId);
	return buildTask(schedule);
}
