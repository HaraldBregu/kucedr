import path from 'node:path';
import { isAppEntry } from './app_entry_validate';
import { isAppId } from './app_id';
import { appDirectory } from './app_directory';

export function appEntryPath(id: string, entry: string, appLocation?: string): string {
	if (!isAppId(id)) throw new Error(`Invalid app id: ${id}`);
	if (!isAppEntry(entry)) throw new Error(`Invalid app entry: ${entry}`);
	return path.join(appDirectory(id, appLocation), ...entry.split('/'));
}
