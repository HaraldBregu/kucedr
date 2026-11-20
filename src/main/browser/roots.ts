import { readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Where applications keep per-user data on each system.
export function dataRoots(): string[] {
	const home = os.homedir();
	if (process.platform === 'darwin') return [path.join(home, 'Library', 'Application Support')];
	if (process.platform === 'win32')
		return [process.env.LOCALAPPDATA, process.env.APPDATA].filter((root): root is string => Boolean(root));
	const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
	let hidden: string[] = [];
	try {
		hidden = readdirSync(home, { withFileTypes: true })
			.filter((entry) => entry.isDirectory() && /^\.(?!cache$|local$|config$)/.test(entry.name))
			.map((entry) => path.join(home, entry.name));
	} catch {
		hidden = [];
	}
	return [config, ...hidden];
}
