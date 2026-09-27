import { createHash } from 'node:crypto';
import path from 'node:path';
import type { CodingProject } from '../../shared/coding_types';
import { userDataLocation } from '../shared/user_data_location';

export function markdownLocation(project: CodingProject): string {
	const key = createHash('sha256').update(project.directory).digest('hex');
	return path.join(userDataLocation(), 'coder', 'projects', key, 'markdown');
}
