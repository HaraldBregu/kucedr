import type { PluginSource } from './plugin_types';

/** Which script produced a stored result, so chats and documents can be migrated when scripts change. */
export interface PluginScriptRef {
	readonly name: string;
	readonly version: string;
	readonly plugin: string;
	readonly pluginVersion?: string;
	readonly createdAt?: string;
}

export function pluginScriptRef(name: string, version: string, plugin: PluginSource, createdAt = new Date().toISOString()): PluginScriptRef {
	return { name, version, plugin: plugin.id, ...(plugin.version && { pluginVersion: plugin.version }), createdAt };
}
