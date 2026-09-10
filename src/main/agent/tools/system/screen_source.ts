import { z } from 'zod';
import { tool } from '../tool';

export const selectScreenSourceTool = tool({
	id: 'select_screen_source',
	name: 'Select screen source',
	description:
		'Present the user with the display or window choices returned by screen_recorder. Call this immediately after screen_recorder returns status "selection_required", passing the sources unchanged. Then call screen_recorder again with the returned sourceId.',
	inputSchema: z.object({
		sources: z
			.array(
				z.object({
					id: z.string().trim().min(1).max(256),
					name: z.string().trim().min(1).max(256),
					type: z.enum(['screen', 'window']),
				})
			)
			.min(1)
			.max(64)
			.describe('Capture sources returned by screen_recorder, unchanged.'),
	}),
	execute: () => {
		throw new Error('Screen source selection must be executed by the agent runtime.');
	},
});
