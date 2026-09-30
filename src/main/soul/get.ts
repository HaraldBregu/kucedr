import { readFile } from 'node:fs/promises';
import { agentLocation } from '../shared/agent_location';
import { ensureSoul } from './ensure';

export function getSoul(workspace = agentLocation()): Promise<string> {
	return readFile(ensureSoul(workspace), 'utf8');
}
