import { z } from 'zod';
import { tool } from '../tool';

export const delegateA2aTool = tool({
	id: 'delegate_a2a',
	category: 'delegation',
	name: 'Delegate to remote agent',
	description:
		'Delegate a task to a configured remote A2A agent. Call list_a2a_agents first to obtain a current enabled agent ID.',
	hardApproval: true,
	inputSchema: z.object({
		agentId: z.string().trim().min(1).max(200).describe('Configured remote agent identifier.'),
		prompt: z
			.string()
			.trim()
			.min(1)
			.max(100_000)
			.describe('Task or message to send to the remote agent.'),
		taskId: z
			.string()
			.trim()
			.min(1)
			.max(200)
			.optional()
			.describe('Remote task ID when continuing an interrupted task.'),
		contextId: z
			.string()
			.trim()
			.min(1)
			.max(200)
			.optional()
			.describe('Remote context ID when continuing an interrupted task.'),
	}),
	execute: async ({ agentId, prompt, taskId, contextId }, signal) => {
		const { sendA2aMessage } = await import('../../a2a/send');
		return sendA2aMessage(agentId, prompt, signal, taskId, contextId);
	},
});
