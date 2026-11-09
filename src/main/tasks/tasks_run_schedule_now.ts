import { fire } from './tasks_fire';
import { running } from './tasks_module_state';
import type { TaskScheduledTask } from './tasks_types';

export function runScheduleNow(scheduleId: string): TaskScheduledTask {
	if (running.has(scheduleId)) throw new Error(`Task schedule is already running: ${scheduleId}`);
	const task = fire(scheduleId);
	if (!task) throw new Error(`Task schedule not found: ${scheduleId}`);
	return task;
}
