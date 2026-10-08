import { z } from 'zod';
import { tool } from '../tool';

export const cancelA2aTaskTool = tool({
	id: 'cancel_a2a_task',
	category: 'delegation',
	name: 'Cancel remote task',
	description: 'Request cancellation of a known remote A2A task.',
	hardApproval: true,
	inputSchema: z.object({
		agentId: z.string().trim().min(1).max(200),
		taskId: z.string().trim().min(1).max(200),
	}),
	execute: async ({ agentId, taskId }, signal) => {
		const { cancelA2aTask } = await import('../../a2a/cancel');
		return cancelA2aTask(agentId, taskId, signal);
	},
});
