import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import type { Workspace } from '../../workspaces/types';
import { getAgentProfilePermissions } from '../agent_profiles';

export function storedPermissions(workspace: Workspace): unknown {
	if (workspace.id === DEFAULT_WORKSPACE) return getAgentProfilePermissions('chat');
	try {
		return JSON.parse(readFileSync(path.join(workspace.settings, 'permissions.json'), 'utf8'));
	} catch {
		return undefined;
	}
}
