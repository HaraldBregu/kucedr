import { exists } from './tasks_exists';
import { MAX_RUNNING_TASKS } from './tasks_limits';
import { requireSchedule } from './tasks_require_schedule';
import { runner, running } from './tasks_module_state';
import { unscheduleJob } from './tasks_unschedule_job';
import { trigger } from './tasks_trigger';
import { update } from './tasks_update';
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
	} else if (running.size >= MAX_RUNNING_TASKS) {
		console.warn('[Task]', `Schedule ${scheduleId} skipped: ${running.size} tasks already running.`);
	} else {
		const controller = new AbortController();
		running.set(scheduleId, controller);
		const settle = (error?: string): void => {
			if (exists(scheduleId))
				update(scheduleId, { lastRun: { at: new Date().toISOString(), ...(error ? { error } : {}) } });
		};
		void Promise.resolve()
			.then(() => run(schedule, controller.signal))
			.then(
				() => settle(),
				(error) => {
					console.error('[Task]', `Schedule ${scheduleId} agent run failed.`, error);
					settle(error instanceof Error ? error.message : String(error));
				}
			)
			.finally(() => running.delete(scheduleId));
	}
	return trigger(scheduleId);
}
