import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { agentLocation } from '../../shared/agent_location';
import { libraryLocation } from '../../shared/library_location';
import { realPath } from '../../shared/real_path';
import { userDataLocation } from '../../shared/user_data_location';

export function protectedRoots(): { read: string[]; write: string[]; writable: string[] } {
	const home = os.homedir();
	const data = userDataLocation();
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
		...browsers,
		path.join(app.getPath('sessionData'), 'Partitions', 'agent-browser'),
		...[
			['providers'],
			['mcp'],
			['credentials'],
			['browser'],
			['coder', 'credentials.json'],
			['settings', 'account.json'],
			['settings', 'providers.json'],
			['settings', 'storage.json'],
			['settings', 'provider-vault.json'],
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
		writable: [agentLocation(), libraryLocation()].map(realPath),
	};
}
