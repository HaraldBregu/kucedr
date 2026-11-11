import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { PluginScriptType, PluginSource } from '../../../shared/plugin_types';
import { pluginDirs } from '../plugins_dirs';
import { readPluginScript, type PluginScriptManifest } from './plugin_script_read';

export type PluginScript = PluginScriptManifest & { readonly plugin: PluginSource };

/** Every enabled plugin's scripts of one type; built-in plugins claim names first, then the first plugin to claim a name wins. */
export function pluginScripts(type: PluginScriptType = 'UI'): PluginScript[] {
	const scripts = new Map<string, PluginScript>();
	const dirs = pluginDirs('scripts').sort((left, right) => Number(right.builtIn) - Number(left.builtIn));
	for (const { directory, plugin } of dirs) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
			try {
				const script = readPluginScript(path.join(directory, entry.name));
				if (scripts.has(script.name)) {
					console.warn(`[plugins] Script "${script.name}" from ${plugin.id} is already provided.`);
					continue;
				}
				scripts.set(script.name, { ...script, plugin });
			} catch (error) {
				console.warn(`[plugins] ${plugin.id}: ${error instanceof Error ? error.message : error}`);
			}
		}
	}
	return [...scripts.values()].filter((script) => script.type === type);
}
