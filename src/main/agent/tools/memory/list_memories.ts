import { z } from 'zod';
import type { MemoryService } from '../../../../shared/memory_types';
import type { Tool } from '../../types';
import { tool } from '../tool';

export function listMemoriesTool(memory: Pick<MemoryService, 'list'>): Tool {
	return tool({
		id: 'list_memories',
		name: 'List memories',
		description: 'List persistent memories with their stable IDs for exact deletion.',
		planSafe: true,
		inputSchema: z.object({}).strict(),
		execute: async () => ({ memories: await memory.list() }),
	});
}
