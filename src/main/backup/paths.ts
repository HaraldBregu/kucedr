import { existsSync } from 'node:fs';
import type { StorageSyncSettings } from '../../shared/storage_types';
import { readWorkspaces } from '../workspaces/read';

export function backupPaths(settings: StorageSyncSettings): string[] {
	if (!settings.includeWorkspaces) return settings.paths;
	const folders = readWorkspaces()
		.map((record) => record.folder)
		.filter((folder) => existsSync(folder));
	return [...new Set([...settings.paths, ...folders])];
}
