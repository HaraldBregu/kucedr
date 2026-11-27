import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_WORKSPACE } from '../../../shared/workspaces_types';
import { realPath } from '../../shared/real_path';
import { userDataLocation } from '../../shared/user_data_location';
import { currentWorkspace } from '../../workspaces/current';
import { readWorkspaces } from '../../workspaces/read';
import { resolveWorkspace } from '../../workspaces/resolve';
import { browserProfiles } from './browsers';

export function protectedRoots(): { read: string[]; write: string[]; writable: string[] } {
	const home = os.homedir();
	const data = userDataLocation();
	const workspace = currentWorkspace();
	const others = readWorkspaces().filter((record) => record.id !== workspace.id);
	const base = resolveWorkspace(DEFAULT_WORKSPACE);
	const system =
		process.platform === 'darwin'
			? [
					['Library', 'Keychains'],
					['Library', 'Cookies'],
				].map((segments) => path.join(home, ...segments))
			: process.platform === 'win32'
				? [process.env.LOCALAPPDATA, process.env.APPDATA]
						.filter((root): root is string => Boolean(root))
						.map((root) => path.join(root, 'Microsoft', 'Credentials'))
				: [];
	const read = [
		...[
			['.ssh'],
			['.aws'],
			['.gnupg'],
			['.config', 'gh'],
			['.netrc'],
			['.docker', 'config.json'],
			['.kube'],
		].map((segments) => path.join(home, ...segments)),
		...system,
		...browserProfiles,
		path.join(app.getPath('sessionData'), 'Partitions'),
		...(workspace.id === DEFAULT_WORKSPACE ? [] : [base.files]),
		...otherSessions(base.sessions, workspace.id),
		...others.map((record) => record.folder),
		...[
			['providers'],
			['mcp'],
			['credentials'],
			['browser'],
			['agent-browser'],
			['settings'],
			['logs'],
			['coder', 'credentials.json'],
		].map((segments) => path.join(data, ...segments)),
	];
	const write = [
		...read,
		data,
		...['.zshrc', '.zprofile', '.bashrc', '.bash_profile', '.profile'].map((name) =>
			path.join(home, name)
		),
		...(process.platform === 'darwin' ? [path.join(home, 'Library', 'LaunchAgents')] : []),
	];
	return {
		read: [...new Set(read.map(realPath))],
		write: [...new Set(write.map(realPath))],
		writable: [workspace.files, workspace.library].map(realPath),
	};
}
