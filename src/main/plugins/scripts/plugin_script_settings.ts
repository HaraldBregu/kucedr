import { pluginsStore } from '../plugins_store';

/** The values saved in Settings → Scripts for one script. */
export function pluginScriptSettings(name: string): Record<string, string> {
	return { ...(pluginsStore.get('scriptSettings')[name] ?? {}) };
}
