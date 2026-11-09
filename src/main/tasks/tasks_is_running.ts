import { running } from './tasks_module_state';

export function isRunning(scheduleId: string): boolean {
	return running.has(scheduleId);
}
