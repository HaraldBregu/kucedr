import { readFile } from 'node:fs/promises';
import { agentLocation } from '../shared/agent_location';
import { ensureIdentity } from './ensure';

export function getIdentity(workspace = agentLocation()): Promise<string> {
	return readFile(ensureIdentity(workspace), 'utf8');
}
