import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function ensureUser(workspace: string): string {
	const directory = path.join(userDataLocation(), 'user');
	const target = path.join(directory, 'USER.md');
	if (existsSync(target)) return target;
	mkdirSync(directory, { recursive: true });
	const legacy = path.join(workspace, 'USER.md');
	const resources =
		process.defaultApp || !process.resourcesPath ? process.cwd() : process.resourcesPath;
	copyFileSync(
		existsSync(legacy) ? legacy : path.join(resources, 'resources', 'templates', 'USER.md'),
		target
	);
	return target;
}
