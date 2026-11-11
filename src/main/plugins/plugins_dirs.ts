import path from 'node:path';
import type { PluginKind, PluginSource } from '../../shared/plugin_types';
import { scanPlugins } from './plugins_scan';
import { disabledPlugins } from './plugins_disabled';

export interface PluginDirectory {
	/** `<plugin>/<kind>`: each child folder is one contribution. */
	readonly directory: string;
	readonly plugin: PluginSource;
	readonly builtIn: boolean;
}

export function pluginDirs(kind: PluginKind): PluginDirectory[] {
	const disabled = disabledPlugins();
	return scanPlugins().flatMap(({ id, directory, builtIn, manifest }) =>
		manifest && !disabled.has(id) && manifest.contributes[kind].length > 0
			? [{ directory: path.join(directory, kind), plugin: { id, name: manifest.title, version: manifest.version }, builtIn }]
			: []
	);
}
