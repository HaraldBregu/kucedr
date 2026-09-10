import { randomUUID } from 'node:crypto';
import { activate } from './tasks_activate';
import { create } from './tasks_create';
import type { TaskSchedule, TaskScheduleCreateRequest } from './tasks_types';

export function createSchedule(request: TaskScheduleCreateRequest): TaskSchedule {
	const now = new Date();
	const nowIso = now.toISOString();
	const schedule: TaskSchedule = {
		id: randomUUID(),
		name: request.name.trim(),
		description: request.description?.trim(),
		cronExpression: request.cronExpression?.trim().replace(/\s+/g, ' '),
		enabled: request.enabled ?? true,
		prompt: request.prompt.trim(),
		toolsAllow: request.toolsAllow,
		sessionIds: [],
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	return activate(create(schedule));
}
