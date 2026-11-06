import { z } from 'zod';

export const goalSchema = z.object({
	schemaVersion: z.literal(1),
	id: z.string().uuid(),
	objective: z.string().min(1),
	status: z.enum(['active', 'paused', 'blocked', 'completed', 'budget_limited']),
	criteria: z.array(
		z.object({
			id: z.string().min(1),
			description: z.string().min(1),
			satisfied: z.boolean(),
			evidenceIds: z.array(z.string()),
		})
	),
	steps: z.array(
		z.object({
			id: z.string().min(1),
			description: z.string().min(1),
			status: z.enum(['pending', 'active', 'completed']),
		})
	),
	evidence: z.array(
		z.object({
			id: z.string().min(1),
			source: z.string().min(1),
			summary: z.string().min(1),
			createdAt: z.number(),
		})
	),
	limits: z.object({
		maxRuns: z.number().int().positive(),
		maxTokens: z.number().int().positive().optional(),
		maxToolCalls: z.number().int().positive().optional(),
	}),
	usage: z.object({
		runs: z.number().int().nonnegative(),
		inputTokens: z.number().int().nonnegative(),
		outputTokens: z.number().int().nonnegative(),
		toolCalls: z.number().int().nonnegative(),
	}),
	createdAt: z.number(),
	updatedAt: z.number(),
	statusNote: z.string().optional(),
});
