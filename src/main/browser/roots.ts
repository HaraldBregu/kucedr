import { readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Where applications keep per-user data on each system.
export function dataRoots(): string[] {
	const home = os.homedir();
	if (process.platform === 'darwin') return [path.join(home, 'Library', 'Application Support')];
	if (process.platform === 'win32')
		return [process.env.LOCALAPPDATA, process.env.APPDATA].filter((root): root is string => Boolean(root));
	const roots = [process.env.XDG_CONFIG_HOME || path.join(home, '.config')];
	try {
		for (const entry of readdirSync(home, { withFileTypes: true }))
			if (entry.isDirectory() && /^\.(?!cache$|local$|config$)/.test(entry.name))
				roots.push(path.join(home, entry.name));
	} catch {
		return roots;
	}
	return roots;
}
