import { remove } from './tasks_remove';
import { unscheduleJob } from './tasks_unschedule_job';

export function deleteSchedule(scheduleId: string): void {
	unscheduleJob(scheduleId);
	remove(scheduleId);
}
