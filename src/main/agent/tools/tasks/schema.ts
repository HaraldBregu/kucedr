import { z } from 'zod';

export const taskIdSchema = z.object({
	taskId: z.string().min(1).describe('Identifier of the task to act on.'),
});

export const createTaskRequestSchema = z.object({
	name: z.string(),
	description: z.string().optional(),
	cronExpression: z.string().optional(),
	enabled: z.boolean().optional(),
	prompt: z.string(),
});

export const updateTaskRequestSchema = z
	.object({
		name: z.string().optional(),
		description: z.string().optional(),
		cronExpression: z.string().optional(),
		enabled: z.boolean().optional(),
		prompt: z.string().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: 'update_task requires at least one field in request.',
	});
