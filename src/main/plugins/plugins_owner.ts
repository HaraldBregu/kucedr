import path from 'node:path';
import type { PluginSource } from '../../shared/plugin_types';
import { scanPlugins } from './plugins_scan';

export function pluginOwner(target: string): PluginSource | undefined {
	const resolved = path.resolve(target);
	const owner = scanPlugins().find(
		(plugin) => plugin.manifest && resolved.startsWith(`${plugin.directory}${path.sep}`)
	);
	return owner?.manifest ? { id: owner.id, name: owner.manifest.name } : undefined;
}
