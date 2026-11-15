import os from 'node:os';
import path from 'node:path';
import { agentLocation } from '../../shared/agent_location';
import { libraryLocation } from '../../shared/library_location';
import { realPath } from '../../shared/real_path';
import { userDataLocation } from '../../shared/user_data_location';
import { samePathOrWithin } from './same_path_or_within';

export function isBroadTarget(target: string): boolean {
	const data = userDataLocation();
	const resolved = realPath(target);
	return (
		path.dirname(resolved) === resolved ||
		samePathOrWithin(os.homedir(), resolved) ||
		samePathOrWithin(data, resolved) ||
		(samePathOrWithin(resolved, data) &&
			![agentLocation(), libraryLocation()].some((directory) => samePathOrWithin(resolved, directory)))
	);
}
