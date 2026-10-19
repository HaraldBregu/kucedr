export const PLUGIN_KINDS = ['apps', 'extensions', 'mcp', 'providers', 'skills'] as const;

/** The built-in plugin that ships Kucedr's own apps, MCP servers, and skills; it can't be disabled or replaced. */
export const CORE_PLUGIN_ID = 'kucedr';

export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** The plugin that contributed a catalog entry; absent for bundled and user entries. */
export interface PluginSource {
	readonly id: string;
	readonly name: string;
}

export interface PluginExtension {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly slot: string;
	/** The extension's icon as a data URL. */
	readonly icon?: string;
}

export interface PluginInfo {
	readonly id: string;
	readonly name: string;
	readonly version?: string;
	readonly description?: string;
	readonly author?: string;
	/** The plugin's icon as a data URL. */
	readonly icon?: string;
	readonly builtIn: boolean;
	readonly core: boolean;
	readonly enabled: boolean;
	/** Why the plugin could not be loaded; its contributions are hidden while set. */
	readonly error?: string;
	readonly contributes: Readonly<Record<PluginKind, readonly string[]>>;
	readonly extensions: readonly PluginExtension[];
}
