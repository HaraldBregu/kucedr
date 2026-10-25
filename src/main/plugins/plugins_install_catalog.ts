import type { PluginInfo } from '../../shared/plugin_types';
import { listCatalog } from './plugins_catalog';
import { downloadPlugin } from './plugins_download';

export async function installCatalogPlugin(id: string): Promise<PluginInfo> {
	const plugin = (await listCatalog()).find((entry) => entry.id === id);
	if (!plugin) throw new Error(`"${id}" is not in the plugin catalog.`);
	return downloadPlugin(plugin.url, plugin.integrity);
}
