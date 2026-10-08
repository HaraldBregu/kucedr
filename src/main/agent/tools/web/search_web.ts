import { z } from 'zod';
import { getSearchSettings, searchWeb } from '../../../search';
import type { Tool } from '../../types';
import { tool } from '../tool';

const searchWebTool = tool({
	id: 'search_web',
	category: 'web',
	name: 'Search web',
	description:
		'Search the web for current information using the configured search engine. Returns a list of results with title, url, and description.',
	planSafe: true,
	inputSchema: z.object({
		query: z.string().min(1).describe('Search query.'),
		count: z
			.number()
			.int()
			.min(1)
			.max(20)
			.optional()
			.describe('Number of results to return (default 5).'),
	}),
	execute: async ({ query, count }, signal) => {
		return JSON.stringify(await searchWeb({ query, count }, signal), null, 2);
	},
});

export function getSearchWebTools(): Tool[] {
	const { engineId, configured } = getSearchSettings();
	return engineId && configured[engineId] ? [searchWebTool] : [];
}
