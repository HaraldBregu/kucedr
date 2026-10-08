import { z } from 'zod';
import { getSoul } from '../../../soul';
import { tool } from '../tool';

export const getSoulTool = tool({
	id: 'get_soul',
	category: 'bootstrap',
	name: 'Get soul',
	description: 'Get the assistant personality and interaction style.',
	planSafe: true,
	inputSchema: z.object({}),
	execute: () => getSoul(),
});
