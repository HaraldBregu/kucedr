import { getSchedule } from './tasks_get_schedule';
import { normalizeTools } from './tasks_normalize_tools';
import { updateSchedule } from './tasks_update_schedule';
import type { TaskSchedule } from './tasks_types';

export function configureScheduleCapabilities(
	scheduleId: string,
	enabled: boolean,
	toolsAllow: readonly string[]
): TaskSchedule {
	const schedule = getSchedule(scheduleId.trim());
	return updateSchedule(schedule.id, {
		enabled,
		toolsAllow: normalizeTools(toolsAllow),
	});
}
