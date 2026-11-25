import { fire } from './tasks_fire';
import { MAX_RUNNING_TASKS } from './tasks_limits';
import { running } from './tasks_module_state';
import type { TaskScheduledTask } from './tasks_types';

export function runScheduleNow(scheduleId: string): TaskScheduledTask {
	if (running.has(scheduleId)) throw new Error(`Task schedule is already running: ${scheduleId}`);
	if (running.size >= MAX_RUNNING_TASKS)
		throw new Error(`${MAX_RUNNING_TASKS} tasks are already running. Try again when one finishes.`);
	const task = fire(scheduleId);
	if (!task) throw new Error(`Task schedule not found: ${scheduleId}`);
	return task;
}
