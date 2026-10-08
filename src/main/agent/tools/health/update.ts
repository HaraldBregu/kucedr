import { updateHealth } from '../../../health';
import type { Config } from '../../types';
import { tool } from '../tool';
import { z } from 'zod';

export function updateHealthTool(config: Config) {
	return tool({
		id: 'update_health',
		category: 'bootstrap',
		name: 'Update health',
		description: 'Replace the current HEALTH.md information.',
		inputSchema: z.object({
			content: z.string().describe('The complete Markdown content to store in HEALTH.md.'),
		}),
		execute: ({ content }) => updateHealth(config, content),
	});
}
