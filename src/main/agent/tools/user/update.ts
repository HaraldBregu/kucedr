import { z } from 'zod';
import { updateUser } from '../../../user';
import { tool } from '../tool';

export const updateUserTool = tool({
	id: 'update_user',
	name: 'Update user',
	description: 'Update the user profile. Include any existing details that should remain.',
	inputSchema: z.object({ content: z.string().describe('Complete user profile, including details to preserve.') }),
	execute: ({ content }) => updateUser(content),
});
