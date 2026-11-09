import { running } from './tasks_module_state';

export function stopRun(scheduleId: string): void {
	running.get(scheduleId)?.abort();
}
