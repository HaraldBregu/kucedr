import { exists } from './tasks_exists';
import { requireSchedule } from './tasks_require_schedule';
import { runner } from './tasks_module_state';
import { unscheduleJob } from './tasks_unschedule_job';
import { trigger } from './tasks_trigger';
import type { TaskScheduledTask } from './tasks_types';

export function fire(scheduleId: string): TaskScheduledTask | undefined {
	if (!exists(scheduleId)) {
		console.warn('[Task]', `Orphaned tasks job removed: schedule ${scheduleId} no longer exists.`);
		unscheduleJob(scheduleId);
		return undefined;
	}
	const schedule = requireSchedule(scheduleId);
	const run = runner;
	if (!run) {
		console.warn('[Task]', `Schedule ${scheduleId} skipped: no agent runner registered.`);
	} else if (running.has(scheduleId)) {
		console.warn('[Task]', `Schedule ${scheduleId} skipped: previous run still in progress.`);
	} else {
		running.add(scheduleId);
		void Promise.resolve()
			.then(() => run(schedule))
			.catch((error) => {
				console.error('[Task]', `Schedule ${scheduleId} agent run failed.`, error);
			})
			.finally(() => running.delete(scheduleId));
	}
	return trigger(scheduleId);
}
