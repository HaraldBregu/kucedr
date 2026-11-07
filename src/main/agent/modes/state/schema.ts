import { z } from 'zod';

export const itemSchema = z
	.object({
		text: z.string().trim().min(1).max(500),
		status: z.enum(['pending', 'in_progress', 'done']),
		evidence: z.string().trim().min(1).max(1000).optional(),
	})
	.strict();

export const stateSchema = z
	.object({
		mode: z.string().min(1),
		status: z.enum(['active', 'completed', 'blocked']),
		objective: z.string().trim().min(1).max(2000),
		items: z.array(itemSchema).max(30),
		note: z.string().optional(),
		updatedAt: z.number(),
	})
	.strict();
