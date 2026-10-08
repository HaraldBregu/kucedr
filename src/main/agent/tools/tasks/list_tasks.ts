import { listTasks } from '../../../tasks';
import { tool } from '../tool';
import { z } from 'zod';

export const listTasksTool = tool({
	id: 'list_tasks',
	category: 'task',
	name: 'List tasks',
	description:
		'List every persisted background task, including each task id, name, prompt, cron schedule, and enabled state. Use when the user asks "Show my scheduled tasks," "What automations do I have?", or "Which tasks are enabled?" Also use it before updating, deleting, or running a task when the user identifies the task by name and its exact id is not already available in the conversation.',
	planSafe: true,
	inputSchema: z.object({}),
	execute: () => listTasks(),
});
