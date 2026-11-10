import { PLUGIN_SCRIPT_TYPES } from '../../../shared/plugin_types';
import { pluginsStore } from '../plugins_store';
import { pluginScripts } from './plugin_script_list';

/** Saves a script's Settings → Scripts values; only keys its manifest `settings` declares are accepted. */
export function savePluginScriptSettings(name: string, values: Record<string, string>): void {
	const script = PLUGIN_SCRIPT_TYPES.flatMap((type) => pluginScripts(type)).find(
		(candidate) => candidate.name === name
	);
	if (!script) throw new Error('Unknown script.');
	const properties = script.settings?.inputSchema.properties ?? {};
	const saved: Record<string, string> = {};
	for (const [key, input] of Object.entries(values)) {
		if (!(key in properties)) throw new Error('Unknown script setting.');
		const value = input.trim();
		if (value) saved[key] = value;
	}
	pluginsStore.set('scriptSettings', { ...pluginsStore.get('scriptSettings'), [name]: saved });
}
