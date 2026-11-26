import type { StorageSyncFolder } from '../../shared/storage_types';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { skillsRoot } from '../agent/skills/skills_root';
import { resolveWorkspace } from '../workspaces/resolve';

export function syncFolders(): StorageSyncFolder[] {
	const workspace = resolveWorkspace(DEFAULT_WORKSPACE);
	return [
		{ key: 'agent', path: workspace.files },
		{ key: 'sessions', path: workspace.sessions },
		{ key: 'library', path: workspace.library },
		{ key: 'skills', path: skillsRoot },
	];
}
