import { z } from 'zod';
import { tool } from '../tool';

export const getA2aTaskTool = tool({
	id: 'get_a2a_task',
	name: 'Get remote task',
	description: 'Get the current state and output of a known remote A2A task.',
	inputSchema: z.object({
		agentId: z.string().trim().min(1).max(200),
		taskId: z.string().trim().min(1).max(200),
	}),
	execute: async ({ agentId, taskId }, signal) => {
		const { getA2aTask } = await import('../../a2a/get');
		return getA2aTask(agentId, taskId, signal);
	},
});
