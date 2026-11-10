import os from 'node:os';
import path from 'node:path';
import { agentLocation } from '../../shared/agent_location';
import { libraryLocation } from '../../shared/library_location';
import { realPath } from '../../shared/real_path';
import { userDataLocation } from '../../shared/user_data_location';
import { isPathWithin } from './permissions_path';

export function isBroadTarget(target: string): boolean {
	const data = realPath(userDataLocation());
	const trusted = [agentLocation(), libraryLocation()].map(realPath);
	return (
		path.dirname(target) === target ||
		isPathWithin(target, realPath(os.homedir())) ||
		isPathWithin(target, data) ||
		(isPathWithin(data, target) && !trusted.some((directory) => isPathWithin(directory, target)))
	);
}
