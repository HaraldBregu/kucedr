import cron from 'node-cron';
import { fire } from './tasks_fire';
import type { TaskJobHandle } from './tasks_internal_types';
import type { TaskSchedule } from './tasks_types';

export function createTaskJob(schedule: TaskSchedule): TaskJobHandle | undefined {
	if (!schedule.cronExpression || !cron.validate(schedule.cronExpression)) {
		console.warn(
			'[Task]',
			`Schedule ${schedule.id} has an invalid cron expression: ${schedule.cronExpression}`
		);
		return undefined;
	}
	if (cronInterval(schedule.cronExpression) < MIN_TASK_INTERVAL_MINUTES) {
		console.warn(
			'[Task]',
			`Schedule ${schedule.id} skipped: it runs more often than every ${MIN_TASK_INTERVAL_MINUTES} minutes.`
		);
		return undefined;
	}
	const task = cron.schedule(schedule.cronExpression, () => fire(schedule.id), {
		name: `tasks:${schedule.id}`,
	});
	return { stop: () => task.destroy(), getNextRun: () => task.getNextRun() };
}
