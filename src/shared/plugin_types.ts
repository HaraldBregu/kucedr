export const PLUGIN_KINDS = ['apps', 'mcp_servers', 'providers', 'skills'] as const;

export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** The plugin that contributed a catalog entry; absent for bundled and user entries. */
export interface PluginSource {
	readonly id: string;
	readonly name: string;
}

export interface PluginInfo {
	readonly id: string;
	readonly name: string;
	readonly version?: string;
	readonly description?: string;
	readonly author?: string;
	readonly builtIn: boolean;
	readonly enabled: boolean;
	/** Why the plugin could not be loaded; its contributions are hidden while set. */
	readonly error?: string;
	readonly contributes: Readonly<Record<PluginKind, readonly string[]>>;
}
