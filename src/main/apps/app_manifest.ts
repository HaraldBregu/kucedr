import path from 'node:path';
import { isAppId } from './app_id';
import { appDirectory } from './app_directory';

export function appManifestPath(id: string, appLocation?: string): string {
	if (!isAppId(id)) throw new Error(`Invalid app id: ${id}`);
	return path.join(appDirectory(id, appLocation), 'manifest.json');
}
