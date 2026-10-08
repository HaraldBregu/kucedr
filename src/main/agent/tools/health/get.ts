import { getHealth } from '../../../health';
import type { Config } from '../../types';
import { tool } from '../tool';
import { z } from 'zod';

export function getHealthTool(config: Config) {
	return tool({
		id: 'get_health',
		category: 'bootstrap',
		name: 'Get health',
		description: 'Read the current HEALTH.md information.',
		planSafe: true,
		inputSchema: z.object({}),
		execute: () => getHealth(config),
	});
}
