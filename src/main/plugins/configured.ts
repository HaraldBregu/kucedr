import { pluginsStore } from './plugins_store';

export function configuredPluginSettings(id: string): string[] {
	return [...new Set([
		...Object.keys(pluginsStore.get('settings')[id] ?? {}),
		...Object.keys(pluginsStore.get('secrets')?.[id] ?? {}),
	])];
}
