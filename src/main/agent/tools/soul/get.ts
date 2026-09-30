import { z } from 'zod';
import { getSoul } from '../../../soul';
import { tool } from '../tool';

export const getSoulTool = tool({
	id: 'get_soul',
	name: 'Get soul',
	description: 'Read SOUL.md in .kucedr/soul/.',
	planSafe: true,
	inputSchema: z.object({}),
	execute: () => getSoul(),
});
