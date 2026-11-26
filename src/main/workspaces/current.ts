import { workspaceScope } from './scope';
import type { Workspace } from './types';

export function currentWorkspace(): Workspace {
	const workspace = workspaceScope.getStore();
	if (!workspace) throw new Error('No workspace is bound to this call.');
	return workspace;
}
