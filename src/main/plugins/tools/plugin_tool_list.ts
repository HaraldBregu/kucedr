import { readdirSync } from 'node:fs';
import path from 'node:path';
import type { PluginSource } from '../../../shared/plugin_types';
import { pluginDirs } from '../plugins_dirs';
import { readPluginTool, type PluginToolManifest } from './plugin_tool_read';

export type PluginTool = PluginToolManifest & { readonly plugin: PluginSource };

/** Every enabled plugin's tools; the first plugin to claim a name wins. */
export function pluginTools(): PluginTool[] {
	const tools = new Map<string, PluginTool>();
	for (const { directory, plugin } of pluginDirs('tools')) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
			try {
				const tool = readPluginTool(path.join(directory, entry.name));
				if (tools.has(tool.name)) {
					console.warn(`[plugins] Tool "${tool.name}" from ${plugin.id} is already provided.`);
					continue;
				}
				tools.set(tool.name, { ...tool, plugin });
			} catch (error) {
				console.warn(`[plugins] ${plugin.id}: ${error instanceof Error ? error.message : error}`);
			}
		}
	}
	return [...tools.values()];
}
