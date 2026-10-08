import { deleteTask } from '../../../tasks';
import { tool } from '../tool';
import { taskIdSchema } from './schema';

export const deleteTaskTool = tool({
	id: 'delete_task',
	category: 'task',
	name: 'Delete task',
	description:
		'Permanently delete one persisted background task by id so it can no longer run on its schedule or be started manually. Use only for an explicit deletion request such as "Delete my old weekly report task" or "Remove that scheduled automation." If the user gives a name instead of an id, call list_tasks first and identify the matching task before deleting it.',
	inputSchema: taskIdSchema,
	execute: ({ taskId }) => {
		deleteTask(taskId);
	},
});
