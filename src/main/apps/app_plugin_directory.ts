import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PluginSource } from '../../shared/plugin_types';
import { pluginDirs } from '../plugins/plugins_dirs';

export function pluginAppDirectory(
	id: string
): { directory: string; plugin: PluginSource } | undefined {
	for (const entry of pluginDirs('apps')) {
		const directory = path.join(entry.directory, id);
		if (existsSync(directory)) return { directory, plugin: entry.plugin };
	}
	return undefined;
}
