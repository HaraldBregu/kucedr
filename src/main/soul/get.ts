import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { agentLocation } from '../shared/agent_location';
import { userDataLocation } from '../shared/user_data_location';

export async function getSoul(workspace = agentLocation()): Promise<string> {
	for (const file of [
		path.join(userDataLocation(), 'soul', 'SOUL.md'),
		path.join(workspace, 'SOUL.md'),
	]) {
		try {
			return await readFile(file, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		}
	}
	return '';
}
