import { soulSchema, updateSoul } from '../../../soul';
import { tool } from '../tool';

export const updateSoulTool = tool({
	id: 'update_soul',
	name: 'Update soul',
	description: 'Update the assistant tone, boundaries, and interaction style. Include existing details that should remain.',
	inputSchema: soulSchema,
	execute: (soul) => updateSoul(soul),
});
