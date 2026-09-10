import { getSchedule } from './tasks_get_schedule';
import { updateSchedule } from './tasks_update_schedule';
import type { TaskSchedule } from './tasks_types';

const TOOL_NAME = /^[a-z][a-z0-9_-]{0,63}$/;

export function configureScheduleCapabilities(
	scheduleId: string,
	enabled: boolean,
	toolsAllow: readonly string[]
): TaskSchedule {
	const schedule = getSchedule(scheduleId.trim());
	const normalized = [...new Set(toolsAllow.map((name) => name.trim()).filter(Boolean))];
	if (normalized.length > 32 || normalized.some((name) => !TOOL_NAME.test(name))) {
		throw new Error('Schedule tool allowlist is invalid.');
	}
	return updateSchedule(schedule.id, {
		enabled,
		toolsAllow: normalized,
	});
}
