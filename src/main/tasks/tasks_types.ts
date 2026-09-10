import type { ModelReasoningEffort } from '../../shared/agent_types';

export interface TaskJobInfo {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly expression: string;
	readonly enabled: boolean;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface TaskScheduledTask {
	id: string;
	title: string;
	description?: string;
	createdAt: string;
	updatedAt: string;
}

export interface TaskSchedule {
	id: string;
	name: string;
	description?: string;
	cronExpression?: string;
	enabled: boolean;
	prompt: string;
	effort: ModelReasoningEffort;
	toolsAllow?: string[];
	sessionIds: string[];
	createdAt: string;
	updatedAt: string;
}

export type TaskScheduleCreateRequest = Omit<
	TaskSchedule,
	'id' | 'createdAt' | 'updatedAt' | 'enabled' | 'sessionIds'
> & {
	enabled?: boolean;
};

export type TaskScheduleUpdateRequest = Partial<
	Omit<TaskSchedule, 'id' | 'createdAt' | 'updatedAt'>
>;

export interface TaskScheduleEvent {
	eventId: string;
	scheduleId: string;
	type:
		| 'schedule.created'
		| 'schedule.updated'
		| 'schedule.paused'
		| 'schedule.resumed'
		| 'schedule.deleted'
		| 'schedule.loaded'
		| 'schedule.recovered'
		| 'schedule.due'
		| 'schedule.triggered'
		| 'schedule.skipped'
		| 'schedule.missed'
		| 'schedule.failed'
		| 'schedule.completed'
		| 'schedule.permissionDenied'
		| 'schedule.nextRunUpdated';
	timestamp: string;
	message: string;
}

export interface TaskRuntime {
	providerId: string;
	modelId: string;
}

/** Shape persisted to the tasks electron-store file. */
export interface PersistedTaskState {
	enabled?: boolean;
	providerId?: string;
	modelId?: string;
	schedules: TaskSchedule[];
	history?: Record<string, TaskScheduleEvent[]>;
}

export const DEFAULT_TASK_STATE: PersistedTaskState = { schedules: [], history: {} };

export type TaskFunctionId =
	| 'create_schedule'
	| 'update_schedule'
	| 'pause_schedule'
	| 'resume_schedule'
	| 'delete_schedule'
	| 'get_schedule'
	| 'list_schedules'
	| 'run_schedule_now';

export interface TaskFunctionInput {
	create_schedule: { request: TaskScheduleCreateRequest };
	update_schedule: { scheduleId: string; request: TaskScheduleUpdateRequest };
	pause_schedule: { scheduleId: string };
	resume_schedule: { scheduleId: string };
	delete_schedule: { scheduleId: string };
	get_schedule: { scheduleId: string };
	list_schedules: Record<string, never>;
	run_schedule_now: { scheduleId: string };
}

export interface TaskFunctionResult {
	create_schedule: TaskSchedule;
	update_schedule: TaskSchedule;
	pause_schedule: void;
	resume_schedule: void;
	delete_schedule: void;
	get_schedule: TaskSchedule;
	list_schedules: TaskSchedule[];
	run_schedule_now: TaskScheduledTask;
}

export interface TaskEvents {
	subscribe(listener: (event: TaskScheduleEvent) => void): () => void;
}

export type TaskRunner = (schedule: TaskSchedule) => Promise<unknown>;
