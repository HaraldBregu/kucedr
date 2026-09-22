import fs from 'node:fs';
import { realPath } from '../../shared/real_path';
import { resolveUserPath } from '../../shared/user_path';
import { agentLocation } from '../../shared/agent_location';
import { authorizedPaths } from '../permissions/access';

export function authorizeFilePath(filePath: string): string {
	const resolved = realPath(resolveUserPath(filePath, agentLocation()));
	const grant = authorizedPaths.getStore()?.find((entry) => entry.path === resolved);
	if (!grant) throw new Error('File path is outside the approved operation.');
	let stat: fs.Stats | undefined;
	try {
		stat = fs.lstatSync(resolved);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (Boolean(stat) !== grant.exists || (stat && (stat.isSymbolicLink() || stat.dev !== grant.dev || stat.ino !== grant.ino || (stat.isFile() && (stat.size !== grant.size || stat.mtimeMs !== grant.modifiedAt))))) {
		throw new Error('File changed after authorization; request permission again.');
	}
	return resolved;
}
