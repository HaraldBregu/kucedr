import { z } from 'zod';

export const taskIdSchema = z.object({
	taskId: z
		.string()
		.min(1)
		.describe('Exact persisted task id returned by create_task or list_tasks.'),
});

export const createTaskRequestSchema = z.object({
	name: z.string().describe('Short human-readable task name used to identify it later.'),
	description: z.string().optional().describe('Optional explanation of the task purpose.'),
	cronExpression: z
		.string()
		.optional()
		.describe('Optional five-field cron expression controlling recurring execution.'),
	enabled: z
		.boolean()
		.optional()
		.describe('Requested enabled state; create_task still saves new tasks disabled for safety.'),
	prompt: z.string().describe('Complete instruction the background agent should execute.'),
});

export const updateTaskRequestSchema = z
	.object({
		name: z.string().optional().describe('Replacement human-readable task name.'),
		description: z.string().optional().describe('Replacement task description.'),
		cronExpression: z
			.string()
			.optional()
			.describe('Replacement five-field cron expression for recurring execution.'),
		enabled: z
			.boolean()
			.optional()
			.describe('True to activate scheduled execution, false to pause it.'),
		prompt: z
			.string()
			.optional()
			.describe('Replacement instruction the background agent should execute.'),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: 'update_task requires at least one field in request.',
	});
