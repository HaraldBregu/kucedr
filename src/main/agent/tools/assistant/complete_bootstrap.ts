import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { agentLocation } from '../../../shared/agent_location';
import { BOOTSTRAP_FILE } from '../../system/system_types';
import { profileStatus } from '../../system/system_profile_status';
import { tool } from '../tool';

export const completeBootstrapTool = tool({
	id: 'complete_bootstrap',
	name: 'Complete bootstrap',
	description: 'Complete the one-time bootstrap after the assistant identity, soul, and user profile have been updated.',
	inputSchema: z.object({}),
	execute: async () => {
		const workspacePath = path.resolve(agentLocation());
		const { missing } = await profileStatus(workspacePath);
		if (missing.length > 0) throw new Error(`Complete ${missing.map((name) => name.slice(0, -3).toLowerCase()).join(', ')} before finishing bootstrap.`);
		const bootstrapPath = path.join(workspacePath, BOOTSTRAP_FILE);
		await fs.rm(bootstrapPath, { force: true });
		return { completed: true };
	},
});
