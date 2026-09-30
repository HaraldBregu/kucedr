import { z } from 'zod';
import { updateSoul } from '../../../soul';
import { tool } from '../tool';

export const updateSoulTool = tool({
	id: 'update_soul',
	name: 'Update soul',
	description:
		'Create or replace SOUL.md in .kucedr/soul/. Read the current content first to preserve information that should remain.',
	inputSchema: z.object({ content: z.string().describe('Complete Markdown content for SOUL.md.') }),
	execute: ({ content }) => updateSoul(content),
});
