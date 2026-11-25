import { z } from 'zod';
import type { MemoryService } from '../../../../shared/memory_types';
import { tool } from '../tool';

export function forgetTool(memory: MemoryService) {
	return tool({
		id: 'forget',
		category: 'system',
		name: 'Forget',
		description:
			'Delete matching facts from memory right away when the user explicitly asks you to forget something. Pass a distinctive part of the remembered fact as match, not a single common word. Every fact containing match is deleted. Tell the user exactly which facts were deleted, or that nothing matched.',
		inputSchema: z.object({ match: z.string().trim().min(3).max(500) }),
		execute: async ({ match }) => ({ forgotten: (await memory.forget(match)).facts }),
	});
}
