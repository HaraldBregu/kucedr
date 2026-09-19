import { z } from 'zod';
import type { MemoryService } from '../../../../shared/memory_types';
import type { Tool } from '../../types';
import { tool } from '../tool';

export function forgetMemoryTool(memory: Pick<MemoryService, 'forget'>): Tool {
	return tool({
		id: 'forget_memory',
		name: 'Forget memory',
		description: 'Remove exactly one persistent memory by the stable ID returned by list_memories.',
		inputSchema: z.object({
			id: z
				.string()
				.trim()
				.regex(/^memory-[a-f0-9]{16}$/i)
				.describe('Exact stable memory ID returned by list_memories.'),
		}),
		execute: ({ id }) => memory.forget(id),
	});
}
