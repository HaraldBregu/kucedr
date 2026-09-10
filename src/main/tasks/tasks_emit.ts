import { randomUUID } from 'node:crypto';
import { listeners } from './tasks_module_state';
import { writeState } from './tasks_write_state';
import type { TaskSchedule, TaskScheduleEvent } from './tasks_types';

export function emit(schedule: TaskSchedule, type: TaskScheduleEvent['type'], message: string): void {
	const event: TaskScheduleEvent = {
		eventId: randomUUID(),
		scheduleId: schedule.id,
		type,
		timestamp: new Date().toISOString(),
		message,
	};
	writeState((state) => {
		state.history = {
			...state.history,
			[schedule.id]: [event, ...(state.history?.[schedule.id] ?? [])].slice(0, 100),
		};
	});
	for (const listener of listeners) {
		try {
			listener(event);
		} catch (error) {
			console.error('[Task]', 'Task event listener failed.', error);
		}
	}
}
