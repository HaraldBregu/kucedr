export const TASK_TOOL_LABELS: Record<string, { readonly running: string; readonly done: string }> =
	{
		create_task: { running: 'Scheduling task', done: 'Task scheduled' },
		update_task: { running: 'Updating task', done: 'Task updated' },
		delete_task: { running: 'Deleting task', done: 'Task deleted' },
		list_tasks: { running: 'Loading tasks', done: 'Tasks loaded' },
		run_task_now: { running: 'Running task', done: 'Task started' },
		create_schedule: { running: 'Scheduling task', done: 'Task scheduled' },
		update_schedule: { running: 'Updating task', done: 'Task updated' },
		delete_schedule: { running: 'Deleting task', done: 'Task deleted' },
		get_schedule: { running: 'Loading task', done: 'Task loaded' },
		list_schedules: { running: 'Loading tasks', done: 'Tasks loaded' },
		pause_schedule: { running: 'Pausing task', done: 'Task paused' },
		resume_schedule: { running: 'Resuming task', done: 'Task resumed' },
		run_schedule_now: { running: 'Running task', done: 'Task started' },
	};

export function isTaskToolType(type: string): boolean {
	return type.toLowerCase() in TASK_TOOL_LABELS;
}
