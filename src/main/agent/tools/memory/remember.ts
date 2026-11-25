import { z } from 'zod';
import type { MemoryService } from '../../../../shared/memory_types';
import { tool } from '../tool';

export function rememberTool(memory: MemoryService, sessionId: string) {
	return tool({
		id: 'remember',
		category: 'system',
		name: 'Remember',
		description:
			'Save one durable fact to memory right away when the user explicitly asks you to remember something. Write the fact as a short, self-contained sentence about the user, then tell the user exactly what was saved.',
		inputSchema: z.object({ fact: z.string().min(1).max(2000) }),
		execute: async ({ fact }) => ({ remembered: (await memory.remember(fact, sessionId)).fact }),
	});
}
