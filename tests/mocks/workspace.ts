import { resolveWorkspace } from '../../src/main/workspaces/resolve';
import { workspaceScope } from '../../src/main/workspaces/scope';

export function currentWorkspace() {
	return workspaceScope.getStore() ?? resolveWorkspace('default');
}
