const TASK_TOOL_IDS = ['create_task', 'update_task', 'delete_task', 'list_tasks', 'run_task_now'];

export function requestedTaskTools(message: string): string[] {
	const normalized = message.toLocaleLowerCase();
	if (!/\b(task|tasks|automation|automations|schedule|scheduled|schdeuled)\b/u.test(normalized))
		return [];
	return TASK_TOOL_IDS;
}
