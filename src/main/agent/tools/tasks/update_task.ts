import { updateTask } from '../../../tasks';
import { tool } from '../tool';
import { taskIdSchema, updateTaskRequestSchema } from './schema';

export const updateTaskTool = tool({
	id: 'update_task',
	category: 'task',
	name: 'Update task',
	description:
		'Change an existing persisted background task by id. It can rename the task, revise its description or agent prompt, replace its cron schedule, or pause scheduled execution. Changing the prompt or schedule pauses the task until the user enables it again in Settings > Tasks; you cannot enable tasks. If only a task name is known, call list_tasks first to resolve its id.',
	inputSchema: taskIdSchema.extend({
		request: updateTaskRequestSchema.describe(
			'Only the task fields the user asked to change: name, description, cronExpression, enabled (false only), or prompt.'
		),
	}),
	execute: ({ taskId, request }) =>
		updateTask(
			taskId,
			request.prompt !== undefined || request.cronExpression !== undefined
				? { ...request, enabled: false }
				: request
		),
});
