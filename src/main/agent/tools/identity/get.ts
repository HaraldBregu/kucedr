import { z } from 'zod';
import { getIdentity } from '../../../identity';
import { tool } from '../tool';

export const getIdentityTool = tool({
	id: 'get_identity',
	category: 'bootstrap',
	name: 'Get identity',
	description: 'Get the assistant identity.',
	planSafe: true,
	inputSchema: z.object({}),
	execute: () => getIdentity(),
});
