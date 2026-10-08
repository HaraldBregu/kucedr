import { updateTask } from '../../../tasks';
import { tool } from '../tool';
import { taskIdSchema, updateTaskRequestSchema } from './schema';

export const updateTaskTool = tool({
	id: 'update_task',
	category: 'task',
	name: 'Update task',
	description:
		'Change an existing persisted background task by id. It can rename the task, revise its description or agent prompt, replace its cron schedule, or enable and disable scheduled execution. Use for requests such as "Run my inbox summary every hour," "Change the weekly report prompt," "Enable that task," or "Pause the morning task." If only a task name is known, call list_tasks first to resolve its id.',
	inputSchema: taskIdSchema.extend({
		request: updateTaskRequestSchema.describe(
			'Only the task fields the user asked to change: name, description, cronExpression, enabled, or prompt.'
		),
	}),
	execute: ({ taskId, request }) => updateTask(taskId, request),
});
