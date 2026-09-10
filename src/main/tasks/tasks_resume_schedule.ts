import { activate } from './tasks_activate';
import { update } from './tasks_update';
import type { TaskSchedule } from './tasks_types';

export function resumeSchedule(scheduleId: string): TaskSchedule {
	const now = new Date().toISOString();
	return activate(
		update(scheduleId, {
			enabled: true,
			updatedAt: now,
		})
	);
}
