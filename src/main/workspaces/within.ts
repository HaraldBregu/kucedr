import { resolveWorkspace } from './resolve';
import { workspaceScope } from './scope';

export function withinWorkspace<T>(id: string, run: () => T): T {
	return workspaceScope.run(resolveWorkspace(id), run);
}
