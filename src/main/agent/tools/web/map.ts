import { mapSchema } from '../../../../shared/map';
import { tool } from '../tool';

export const mapTool = tool({
	id: 'show_map',
	category: 'web',
	name: 'Show map',
	description:
		'Show an interactive map in chat centered on known coordinates, with optional labeled markers. Obtain coordinates from reliable sources; do not guess them.',
	planSafe: true,
	inputSchema: mapSchema,
	execute: async (input) => JSON.stringify(input),
});
