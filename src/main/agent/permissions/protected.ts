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
	const browsers =
		process.platform === 'darwin'
			? [
					['Library', 'Keychains'],
					['Library', 'Cookies'],
					['Library', 'Safari'],
					['Library', 'Application Support', 'Google', 'Chrome'],
					['Library', 'Application Support', 'BraveSoftware'],
					['Library', 'Application Support', 'Firefox'],
					['Library', 'Application Support', 'Microsoft Edge'],
				].map((segments) => path.join(home, ...segments))
			: process.platform === 'win32'
				? [
						...(process.env.LOCALAPPDATA
							? [
									['Google', 'Chrome', 'User Data'],
									['BraveSoftware'],
									['Microsoft', 'Edge', 'User Data'],
									['Microsoft', 'Credentials'],
								].map((segments) => path.join(process.env.LOCALAPPDATA ?? '', ...segments))
							: []),
						...(process.env.APPDATA
							? [
									['Mozilla', 'Firefox'],
									['Microsoft', 'Credentials'],
								].map((segments) => path.join(process.env.APPDATA ?? '', ...segments))
							: []),
					]
				: [
						['.config', 'google-chrome'],
						['.config', 'chromium'],
						['.config', 'BraveSoftware'],
						['.config', 'microsoft-edge'],
						['.mozilla'],
					].map((segments) => path.join(home, ...segments));
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
