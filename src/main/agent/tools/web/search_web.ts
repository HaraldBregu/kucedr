import { z } from 'zod';
import { getSearchSettings, searchWeb } from '../../../search';
import { leaks } from '../../../shield/leaks';
import type { Tool } from '../../types';
import { tool } from '../tool';

const searchWebTool = tool({
	id: 'search_web',
	category: 'web',
	name: 'Search web',
	description:
		'Search the web for current information using the configured search engine. Returns a list of results with title, url, and description.',
	readOnly: true,
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
		if (leaks(query)) throw new Error('Blocked: the search contains a stored key or token.');
		return JSON.stringify(await searchWeb({ query, count }, signal));
	},
});

export function getSearchWebTools(): Tool[] {
	const { engineId, configured } = getSearchSettings();
	return engineId && configured[engineId] ? [searchWebTool] : [];
}
