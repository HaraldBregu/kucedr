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
}

export const DEFAULT_TASK_STATE: PersistedTaskState = { schedules: [] };

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

export type TaskRunner = (schedule: TaskSchedule) => Promise<unknown>;
