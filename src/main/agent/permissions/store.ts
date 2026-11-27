import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import type { Workspace } from '../../workspaces/types';
import { setAgentProfilePermissions } from '../agent_profiles';
import type { PermissionsSchema } from './permissions_types';

export function storePermissions(workspace: Workspace, permissions: PermissionsSchema): void {
	if (workspace.id === DEFAULT_WORKSPACE) return setAgentProfilePermissions('chat', permissions);
	const file = path.join(workspace.settings, `permissions-${workspace.id}.json`);
	mkdirSync(workspace.settings, { recursive: true, mode: 0o700 });
	writeFileSync(`${file}.tmp`, `${JSON.stringify(permissions, null, '\t')}\n`, { mode: 0o600 });
	renameSync(`${file}.tmp`, file);
}
