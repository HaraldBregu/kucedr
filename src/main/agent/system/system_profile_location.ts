import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import { agentLocation } from '../../shared/agent_location';
import type { Config } from '../types';

export function profileLocation(config: Config): string {
	return config.workspace.id === DEFAULT_WORKSPACE ? path.resolve(config.location) : agentLocation();
}
