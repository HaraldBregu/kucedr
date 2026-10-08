import { runTaskNow } from '../../../tasks';
import { tool } from '../tool';
import { taskIdSchema } from './schema';

export const runTaskNowTool = tool({
	id: 'run_task_now',
	name: 'Run task now',
	description:
		'Start one immediate run of an existing persisted background task by id, without changing its saved prompt, cron schedule, or enabled state. Use when the user asks "Run the inbox summary now," "Execute that task once," or "Test my weekly report task." If the task id is not already known, call list_tasks first to resolve it.',
	inputSchema: taskIdSchema,
	execute: ({ taskId }) => runTaskNow(taskId),
});
