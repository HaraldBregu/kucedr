import { randomUUID } from 'node:crypto';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { currentWorkspace } from '../workspaces/current';
import { activate } from './tasks_activate';
import { create } from './tasks_create';
import { normalizeCron } from './tasks_normalize_cron';
import { normalizeTools } from './tasks_normalize_tools';
import type { TaskSchedule, TaskScheduleCreateRequest } from './tasks_types';

export function createSchedule(request: TaskScheduleCreateRequest): TaskSchedule {
	const workspaceId = currentWorkspace().id;
	const now = new Date();
	const nowIso = now.toISOString();
	const schedule: TaskSchedule = {
		id: randomUUID(),
		name: request.name.trim(),
		description: request.description?.trim(),
		cronExpression:
			request.cronExpression === undefined ? undefined : normalizeCron(request.cronExpression),
		enabled: request.enabled ?? true,
		prompt: request.prompt.trim(),
		toolsAllow: request.toolsAllow && normalizeTools(request.toolsAllow),
		sessionIds: [],
		...(workspaceId === DEFAULT_WORKSPACE ? {} : { workspaceId }),
		createdAt: nowIso,
		updatedAt: nowIso,
	};
	return activate(create(schedule));
}
