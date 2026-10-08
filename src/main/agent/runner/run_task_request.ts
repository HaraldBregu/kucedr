const TASK_TOOL_IDS = ['create_task', 'update_task', 'delete_task', 'list_tasks', 'run_task_now'];

export function requestedTaskTools(message: string): string[] {
	const normalized = message.toLocaleLowerCase();
	if (!/\b(task|tasks|automation|automations|schedule|scheduled|schdeuled)\b/u.test(normalized))
		return [];
	if (/\b(delete|remove)\b/u.test(normalized)) return ['list_tasks', 'delete_task'];
	if (/\b(enable|disable|pause|update|change|edit|rename|reschedule)\w*\b/u.test(normalized))
		return ['list_tasks', 'update_task'];
	if (/\b(run|start|execute|test)\b/u.test(normalized) && /\b(now|once|immediately)\b/u.test(normalized))
		return ['list_tasks', 'run_task_now'];
	if (/\b(create|add|schedule|automate|set up)\b/u.test(normalized)) return ['create_task'];
	if (/\b(list|show|view|what|which|get)\b/u.test(normalized)) return ['list_tasks'];
	return TASK_TOOL_IDS;
}
