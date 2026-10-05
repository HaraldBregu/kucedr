import { updateUser, userSchema } from '../../../user';
import { tool } from '../tool';

export const updateUserTool = tool({
	id: 'update_user',
	name: 'Update user',
	description: 'Update the user profile with name, title, pronouns, and any known preferences. Store the name, title, and pronouns in their separate fields (for example, title "Sir", name "John", pronouns "he/they"). Include existing details that should remain. Add projects only when the user explicitly wants them in the profile; do not infer them from workspace contents.',
	inputSchema: userSchema,
	execute: (user) => updateUser(user),
});
