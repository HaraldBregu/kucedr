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
	description:
		'Complete the one-time bootstrap by deleting BOOTSTRAP.md from the workspace. Call this only after IDENTITY.md, USER.md, and SOUL.md have been updated.',
	inputSchema: z.object({}),
	execute: async () => {
		const workspacePath = path.resolve(agentLocation());
		const { missing } = await profileStatus(workspacePath);
		if (missing.length > 0) throw new Error(`Complete ${missing.join(', ')} before finishing bootstrap.`);
		const bootstrapPath = path.join(workspacePath, BOOTSTRAP_FILE);
		await fs.rm(bootstrapPath, { force: true });
		return { completed: true };
	},
});
