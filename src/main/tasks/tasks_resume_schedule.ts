import { activate } from './tasks_activate';
import { getSchedule } from './tasks_get_schedule';
import { update } from './tasks_update';
import type { TaskSchedule } from './tasks_types';

export function resumeSchedule(scheduleId: string): TaskSchedule {
	getSchedule(scheduleId);
	const now = new Date().toISOString();
	return activate(
		update(scheduleId, {
			enabled: true,
			updatedAt: now,
		})
	);
}
