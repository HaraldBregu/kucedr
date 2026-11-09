import { requireSchedule } from './tasks_require_schedule';
import { update } from './tasks_update';
import type { TaskSchedule } from './tasks_types';

export function associateSession(scheduleId: string, sessionId: string): TaskSchedule {
	const schedule = requireSchedule(scheduleId);
	const sessionIds = schedule.sessionIds ?? [];
	if (sessionIds.includes(sessionId)) return schedule;
	return update(scheduleId, { sessionIds: [...sessionIds, sessionId].slice(-50) });
}
