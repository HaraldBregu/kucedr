import cron from 'node-cron';
import { isActiveSchedule } from './tasks_is_active_schedule';
import { list } from './tasks_list';

export function reconcile(): void {
	const active = new Set(list().filter(isActiveSchedule).map((schedule) => `tasks:${schedule.id}`));
	for (const task of cron.getTasks().values()) {
		if (task.name?.startsWith('tasks:') && !active.has(task.name)) {
			console.warn('[Task]', `Destroying orphaned tasks job ${task.name}.`);
			void task.destroy();
		}
	}
}
