import type { AvailablePlugin } from '../../shared/plugin_types';
import { listCatalog } from './plugins_catalog';
import { listPlugins } from './plugins_list';
import { compareVersions } from './plugins_version_compare';

export async function availablePlugins(): Promise<AvailablePlugin[]> {
	const installed = new Map(listPlugins().map((plugin) => [plugin.id, plugin.version]));
	return (await listCatalog()).flatMap<AvailablePlugin>((plugin) => {
		if (!installed.has(plugin.id)) return [{ ...plugin, update: false }];
		const version = installed.get(plugin.id);
		return !version || compareVersions(plugin.version, version) > 0
			? [{ ...plugin, update: true }]
			: [];
	});
}
