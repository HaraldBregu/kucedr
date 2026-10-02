import { z } from 'zod';
import { updateIdentity } from '../../../identity';
import { tool } from '../tool';

export const updateIdentityTool = tool({
	id: 'update_identity',
	name: 'Update identity',
	description: 'Update the assistant identity. Include any existing details that should remain.',
	inputSchema: z.object({
		content: z.string().describe('Complete assistant identity, including details to preserve.'),
	}),
	execute: ({ content }) => updateIdentity(content),
});
