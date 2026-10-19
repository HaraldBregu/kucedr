import { PLUGIN_KINDS, type PluginInfo, type PluginKind } from '../../shared/plugin_types';
import { scanPlugins } from './plugins_scan';
import { pluginsStore } from './plugins_store';

export function listPlugins(): PluginInfo[] {
	const disabled = new Set(pluginsStore.get('disabled'));
	return scanPlugins().map(({ id, builtIn, manifest, error }) => ({
		id,
		name: manifest?.name ?? id,
		...(manifest && {
			version: manifest.version,
			description: manifest.description,
			...(manifest.author && { author: manifest.author }),
		}),
		builtIn,
		enabled: !disabled.has(id),
		...(error && { error }),
		contributes: Object.fromEntries(
			PLUGIN_KINDS.map((kind) => [kind, manifest?.contributes[kind].map((item) => item.id) ?? []])
		) as Record<PluginKind, string[]>,
	}));
}
