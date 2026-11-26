import { currentWorkspace } from '../workspaces/current';
import { resolveUserPath } from './user_path';

export function mediaDirectory(directory?: string): string {
	const workspace = currentWorkspace();
	return directory === undefined
		? workspace.library
		: resolveUserPath(directory, workspace.files);
}
