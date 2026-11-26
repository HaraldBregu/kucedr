import os from 'node:os';
import path from 'node:path';
import { realPath } from '../../shared/real_path';
import { userDataLocation } from '../../shared/user_data_location';
import { currentWorkspace } from '../../workspaces/current';
import { samePathOrWithin } from './same_path_or_within';

export function isBroadTarget(target: string): boolean {
	const data = userDataLocation();
	const workspace = currentWorkspace();
	const resolved = realPath(target);
	return (
		path.dirname(resolved) === resolved ||
		samePathOrWithin(os.homedir(), resolved) ||
		samePathOrWithin(data, resolved) ||
		(samePathOrWithin(resolved, data) &&
			![workspace.files, workspace.library].some((directory) => samePathOrWithin(resolved, directory)))
	);
}
