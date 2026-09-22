import path from 'node:path';
import { appsRoot } from './app_root';
import { debugAppDirectory } from './app_debug_directory';

export function appDirectory(id: string, appLocation?: string): string {
	return appLocation === undefined
		? debugAppDirectory(id) ?? path.join(appsRoot(), id)
		: path.join(appsRoot(appLocation), id);
}
