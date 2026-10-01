import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';

export async function getIdentity(workspace = agentLocation()): Promise<string> {
	for (const file of [
		path.join(userDataLocation(), 'identity', 'IDENTITY.md'),
		path.join(workspace, 'IDENTITY.md'),
	]) {
		try {
			return await readFile(file, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return '';
}
