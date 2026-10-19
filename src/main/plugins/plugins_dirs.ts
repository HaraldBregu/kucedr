import path from 'node:path';
import type { PluginKind, PluginSource } from '../../shared/plugin_types';
import { scanPlugins } from './plugins_scan';
import { pluginsStore } from './plugins_store';

export interface PluginDirectory {
	/** `<plugin>/<kind>`: each child folder is one contribution. */
	readonly directory: string;
	readonly plugin: PluginSource;
}

export function pluginDirs(kind: PluginKind): PluginDirectory[] {
	const disabled = new Set(pluginsStore.get('disabled'));
	return scanPlugins().flatMap(({ id, directory, manifest }) =>
		manifest && !disabled.has(id) && manifest.contributes[kind].length > 0
			? [{ directory: path.join(directory, kind), plugin: { id, name: manifest.name } }]
			: []
	);
}
