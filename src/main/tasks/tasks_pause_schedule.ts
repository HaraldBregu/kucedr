import { getSchedule } from './tasks_get_schedule';
import { unscheduleJob } from './tasks_unschedule_job';
import { update } from './tasks_update';
import type { TaskSchedule } from './tasks_types';

export function pauseSchedule(scheduleId: string): TaskSchedule {
	getSchedule(scheduleId);
	unscheduleJob(scheduleId);
	const now = new Date().toISOString();
	return update(scheduleId, {
		enabled: false,
		updatedAt: now,
	});
}
