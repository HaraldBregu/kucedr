import os from 'node:os';
import path from 'node:path';
import { realPath } from '../../shared/real_path';
import { userDataLocation } from '../../shared/user_data_location';
import { isPathWithin } from './permissions_path';

export function isBroadTarget(target: string): boolean {
	const data = realPath(userDataLocation());
	return (
		path.dirname(target) === target ||
		isPathWithin(target, realPath(os.homedir())) ||
		isPathWithin(target, data) ||
		isPathWithin(data, target)
	);
}
