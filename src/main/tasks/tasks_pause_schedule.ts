import { emit } from './tasks_emit';
import { unscheduleJob } from './tasks_unschedule_job';
import { update } from './tasks_update';
import type { TaskSchedule } from './tasks_types';

export function pauseSchedule(scheduleId: string): TaskSchedule {
	unscheduleJob(scheduleId);
	const now = new Date().toISOString();
	const updated = update(scheduleId, {
		enabled: false,
		updatedAt: now,
	});
	emit(updated, 'schedule.paused', 'Schedule paused.');
	return updated;
}
