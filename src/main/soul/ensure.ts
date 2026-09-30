import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { userDataLocation } from '../shared/user_data_location';

export function ensureSoul(workspace: string): string {
	const directory = path.join(userDataLocation(), 'soul');
	const target = path.join(directory, 'SOUL.md');
	if (existsSync(target)) return target;
	mkdirSync(directory, { recursive: true });
	const legacy = path.join(workspace, 'SOUL.md');
	const resources = process.defaultApp || !process.resourcesPath ? process.cwd() : process.resourcesPath;
	copyFileSync(existsSync(legacy) ? legacy : path.join(resources, 'resources', 'templates', 'SOUL.md'), target);
	return target;
}
