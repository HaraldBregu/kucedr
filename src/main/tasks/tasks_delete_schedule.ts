import { getSchedule } from './tasks_get_schedule';
import { remove } from './tasks_remove';
import { stopRun } from './tasks_stop_run';
import { unscheduleJob } from './tasks_unschedule_job';

export function deleteSchedule(scheduleId: string): void {
	getSchedule(scheduleId);
	unscheduleJob(scheduleId);
	stopRun(scheduleId);
	remove(scheduleId);
}
