import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import { currentWorkspace } from '../../workspaces/current';
import { getAgentProfileDocument } from '../agent_profiles';
import { protectedRoots } from './protected';
import type { PermissionsSchema, PermissionsView } from './permissions_types';

export function permissionsView(permissions: PermissionsSchema): PermissionsView {
	const roots = protectedRoots();
	const { droppedRules } =
		currentWorkspace().id === DEFAULT_WORKSPACE ? getAgentProfileDocument('chat') : {};
	return {
		...permissions,
		protected: { read: roots.read, write: roots.write.filter((root) => !roots.read.includes(root)) },
		dropped: Array.isArray(droppedRules)
			? droppedRules.filter((rule): rule is string => typeof rule === 'string')
			: [],
	};
}
