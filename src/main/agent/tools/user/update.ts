import { updateUser, userSchema } from '../../../user';
import { tool } from '../tool';

export const updateUserTool = tool({
	id: 'update_user',
	name: 'Update user',
	description: 'Update the user profile with a name and any known preferences. Include existing details that should remain. Add projects only when the user explicitly wants them in the profile; do not infer them from workspace contents.',
	inputSchema: userSchema,
	execute: (user) => updateUser(user),
});
