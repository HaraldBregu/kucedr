import path from 'node:path';
import { debugAppsStore } from './app_debug_store';
import { debugAppPaths } from './app_debug_paths';

export function removeDebugApp(id: string): boolean {
	const paths = debugAppPaths();
	const next = paths.filter((directory) => path.basename(directory) !== id);
	if (next.length === paths.length) return false;
	debugAppsStore.set('paths', next);
	return true;
}
