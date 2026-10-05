import { identitySchema, updateIdentity } from '../../../identity';
import { tool } from '../tool';

export const updateIdentityTool = tool({
	id: 'update_identity',
	name: 'Update identity',
	description: 'Update the assistant identity with a name, title, and role. Store the name and title in separate fields. Include any existing details that should remain.',
	inputSchema: identitySchema,
	execute: (identity) => updateIdentity(identity),
});
