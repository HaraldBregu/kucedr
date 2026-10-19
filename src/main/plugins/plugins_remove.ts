import { rm } from 'node:fs/promises';
import { scanPlugins, refreshPlugins } from './plugins_scan';

export async function removePlugin(id: string): Promise<void> {
	const plugin = scanPlugins().find((item) => item.id === id);
	if (!plugin) throw new Error(`Plugin "${id}" is not installed.`);
	if (plugin.builtIn) throw new Error('Built-in plugins can be disabled but not removed.');
	await rm(plugin.directory, { recursive: true, force: true });
	refreshPlugins();
}
