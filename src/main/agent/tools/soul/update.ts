import { z } from 'zod';
import { updateSoul } from '../../../soul';
import { tool } from '../tool';

export const updateSoulTool = tool({
	id: 'update_soul',
	name: 'Update soul',
	description: 'Update the assistant personality and interaction style. Include any existing details that should remain.',
	inputSchema: z.object({ content: z.string().describe('Complete assistant personality and interaction style, including details to preserve.') }),
	execute: ({ content }) => updateSoul(content),
});
