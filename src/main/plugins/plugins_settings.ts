import { pluginsStore } from './plugins_store';

export function pluginSettings(id: string): Record<string, string> {
	return pluginsStore.get('settings')[id] ?? {};
}
