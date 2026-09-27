import path from 'node:path';
import { existsSync } from 'node:fs';
import { appsRoot } from './app_root';
import { debugAppDirectory } from './app_debug_directory';
import { resourceRoot } from '../shared/resource_root';

export function appDirectory(id: string, appLocation?: string): string {
	if (appLocation !== undefined) return path.join(appsRoot(appLocation), id);
	const installed = path.join(appsRoot(), id);
	if (id === 'workspace') {
		return debugAppDirectory(id) ?? (existsSync(installed) ? installed : path.join(resourceRoot(), 'resources/apps/workspace'));
	}
	return debugAppDirectory(id) ?? installed;
}
