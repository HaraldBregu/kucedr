import type { AvailablePlugin } from '../../shared/plugin_types';
import { listCatalog } from './plugins_catalog';
import { listPlugins } from './plugins_list';
import { compareVersions } from './plugins_version_compare';

export async function availablePlugins(): Promise<AvailablePlugin[]> {
	const plugins = listPlugins();
	const installed = new Map(plugins.map((plugin) => [plugin.id, plugin.version]));
	const builtIn = new Set(plugins.filter((plugin) => plugin.builtIn).map((plugin) => plugin.id));
	return (await listCatalog()).flatMap<AvailablePlugin>((plugin) => {
		if (builtIn.has(plugin.id)) return [];
		if (!installed.has(plugin.id)) return [{ ...plugin, update: false }];
		const version = installed.get(plugin.id);
		return !version || compareVersions(plugin.version, version) > 0
			? [{ ...plugin, update: true }]
			: [];
	});
}
