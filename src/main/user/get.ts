import { readFile } from 'node:fs/promises';
import { agentLocation } from '../shared/agent_location';
import { ensureUser } from './ensure';

export function getUser(workspace = agentLocation()): Promise<string> {
	return readFile(ensureUser(workspace), 'utf8');
}
