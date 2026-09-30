import { z } from 'zod';
import { updateUser } from '../../../user';
import { tool } from '../tool';

export const updateUserTool = tool({
	id: 'update_user',
	name: 'Update user',
	description: 'Create or replace USER.md in .kucedr/user/. Read the current content first to preserve information that should remain.',
	inputSchema: z.object({ content: z.string().describe('Complete Markdown content for USER.md.') }),
	execute: ({ content }) => updateUser(content),
});
