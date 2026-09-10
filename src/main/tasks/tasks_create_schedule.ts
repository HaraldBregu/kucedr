import { randomUUID } from 'node:crypto';
import { activate } from './tasks_activate';
import { create } from './tasks_create';
import { emit } from './tasks_emit';
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
		effort: request.effort,
		toolsAllow: request.toolsAllow,
		sessionIds: [],
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	const created = activate(create(schedule));
	emit(created, 'schedule.created', 'Schedule created.');
	return created;
}
