import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../shared/workspaces_types';
import type { Workspace } from './types';

export function buildWorkspace(id: string, root: string, files: string): Workspace {
	return Object.freeze({
		id,
		root,
		files,
		sessions: path.join(root, 'sessions'),
		library: path.join(root, 'library'),
		memory: path.join(root, 'memory'),
		rag: path.join(root, 'rag'),
		browser: path.join(root, 'browser'),
		coder: path.join(root, 'coder'),
		settings: path.join(root, 'settings'),
		partition: id === DEFAULT_WORKSPACE ? 'persist:agent-browser' : `persist:agent-browser-${id}`,
	});
}
