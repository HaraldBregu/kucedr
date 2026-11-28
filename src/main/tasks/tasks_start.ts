import { enabled } from './tasks_module_state';
import { activate } from './tasks_activate';
import { isActiveSchedule } from './tasks_is_active_schedule';
import { list } from './tasks_list';
import { reconcile } from './tasks_reconcile';

export async function startTask(): Promise<void> {
	if (!enabled) {
		console.warn('[Task]', 'Task automatic execution is globally disabled.');
		return;
	}
	reconcile();
	for (const schedule of list().filter(isActiveSchedule)) {
		activate(schedule);
		if (
			schedule.catchUp &&
			schedule.cronExpression &&
			missed(schedule.cronExpression, new Date(schedule.lastRun?.at ?? schedule.createdAt))
		) {
			console.info('[Task]', `Schedule ${schedule.id} missed a run while the app was closed; running it once.`);
			fire(schedule.id);
		}
	}
	console.info('[Task]', 'Task service started.');
}
