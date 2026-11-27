import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { userDataLocation } from '../shared/user_data_location';
import { buildWorkspace } from './build';
import { readWorkspaces } from './read';
import type { Workspace } from './types';

export function resolveWorkspace(id: string): Workspace {
	const data = userDataLocation();
	if (id === DEFAULT_WORKSPACE) return buildWorkspace(id, data, path.join(data, 'workspace'));
	const record = readWorkspaces().find((entry) => entry.id === id);
	if (!record) throw new Error('Workspace not found.');
	return buildWorkspace(id, data, record.folder);
}
