import type { StorageSyncFolder } from '../../shared/storage_types';
import { sessionsRoot } from '../agent/session';
import { skillsRoot } from '../agent/skills/skills_root';
import { agentLocation } from '../shared/agent_location';
import { libraryLocation } from '../shared/library_location';

export function syncFolders(): StorageSyncFolder[] {
	const workspace = agentLocation();
	return [
		{ key: 'agent', path: workspace },
		{ key: 'sessions', path: sessionsRoot(workspace) },
		{ key: 'library', path: libraryLocation() },
		{ key: 'skills', path: skillsRoot },
	];
}
