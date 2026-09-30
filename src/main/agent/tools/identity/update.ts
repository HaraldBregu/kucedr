import { z } from 'zod';
import { updateIdentity } from '../../../identity';
import { tool } from '../tool';

export const updateIdentityTool = tool({
	id: 'update_identity',
	name: 'Update identity',
	description:
		'Create or replace the agent identity in IDENTITY.md. Read the current identity first to preserve information that should remain.',
	inputSchema: z.object({
		content: z.string().describe('Complete Markdown content for IDENTITY.md.'),
	}),
	execute: ({ content }) => updateIdentity(content),
});
