import { z } from 'zod';
import { getUser } from '../../../user';
import { tool } from '../tool';

export const getUserTool = tool({
	id: 'get_user',
	name: 'Get user',
	description: 'Read USER.md in .kucedr/user/.',
	planSafe: true,
	inputSchema: z.object({}),
	execute: () => getUser(),
});
