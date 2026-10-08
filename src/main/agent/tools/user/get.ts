import { z } from 'zod';
import { getUser } from '../../../user';
import { tool } from '../tool';

export const getUserTool = tool({
	id: 'get_user',
	category: 'bootstrap',
	name: 'Get user',
	description: 'Get the user profile.',
	planSafe: true,
	inputSchema: z.object({}),
	execute: () => getUser(),
});
