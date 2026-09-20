import { z } from 'zod';
import type { MemoryService } from '../../../../shared/memory_types';
import type { Tool } from '../../types';
import { tool } from '../tool';

export function forgetMemoryTool(memory: Pick<MemoryService, 'forget'>): Tool {
	return tool({
		id: 'forget_memory',
		name: 'Forget memory',
		description:
			'Remove persistent memories through the application memory module. Pass a stable ID for one exact record or text shared by every record the user wants forgotten.',
		inputSchema: z.object({
			match: z
				.string()
				.trim()
				.min(1)
				.describe('Exact memory ID or case-insensitive text identifying the memories to remove.'),
		}),
		execute: ({ match }) => memory.forget(match),
	});
}
