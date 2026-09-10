import { clone } from './tasks_clone';
import { readState } from './tasks_read_state';
import type { TaskScheduleEvent } from './tasks_types';

export function listTaskHistory(scheduleId: string): TaskScheduleEvent[] {
	return clone(readState().history?.[scheduleId] ?? []).sort(
		(a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)
	);
}
