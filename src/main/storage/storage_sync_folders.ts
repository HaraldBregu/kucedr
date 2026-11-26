import type { StorageSyncFolder } from '../../shared/storage_types';
import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { userDataLocation } from '../shared/user_data_location';
import { skillsRoot } from '../agent/skills/skills_root';
import { resolveWorkspace } from '../workspaces/resolve';

export function syncFolders(): StorageSyncFolder[] {
	const workspace = resolveWorkspace(DEFAULT_WORKSPACE);
	return [
		{ key: 'agent', path: workspace.files },
		{ key: 'sessions', path: workspace.sessions },
		{ key: 'library', path: workspace.library },
		{ key: 'workspaces', path: path.join(userDataLocation(), 'workspaces') },
		{ key: 'skills', path: skillsRoot },
	];
}
