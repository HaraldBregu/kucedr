import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import { userDataLocation } from '../shared/user_data_location';
import { readWorkspaces } from './read';
import type { Workspace } from './types';

export function resolveWorkspace(id: string): Workspace {
	const data = userDataLocation();
	const record =
		id === DEFAULT_WORKSPACE ? undefined : readWorkspaces().find((entry) => entry.id === id);
	if (id !== DEFAULT_WORKSPACE && !record) throw new Error('Workspace not found.');
	const root = record ? path.join(data, 'workspaces', record.id) : data;
	return Object.freeze({
		id,
		root,
		files: record ? record.folder : path.join(data, 'workspace'),
		sessions: path.join(root, 'sessions'),
		library: path.join(root, 'library'),
		memory: path.join(root, 'memory'),
		rag: path.join(root, 'rag'),
		browser: path.join(root, 'browser'),
		coder: path.join(root, 'coder'),
		settings: path.join(root, 'settings'),
		partition: record ? `persist:agent-browser-${record.id}` : 'persist:agent-browser',
	});
}
