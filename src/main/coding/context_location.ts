import { existsSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';

export function markdownLocation(project: CodingProject): string {
	const managedDirectory = path.join(userDataLocation(), 'coder', 'workspaces', project.id, 'files');
	if (
		project.kind === 'agent-workspace' &&
		existsSync(managedDirectory) &&
		existsSync(project.directory) &&
		realpathSync.native(managedDirectory) === realpathSync.native(project.directory)
	) return project.directory;
	const key = createHash('sha256').update(project.directory).digest('hex');
	return path.join(userDataLocation(), 'coder', 'workspaces', key);
}
