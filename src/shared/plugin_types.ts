import type { ProviderManifestSetting } from './provider_types';
export const PLUGIN_KINDS = ['apps', 'mcp', 'providers', 'skills'] as const;

/** The built-in plugin that ships Kucedr's own apps, MCP servers, and skills; it can't be disabled or replaced. */
export const CORE_PLUGIN_ID = 'kucedr';

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
	readonly categories: readonly string[];
	readonly author?: string;
	/** The plugin's icon as a data URL. */
	readonly icon?: string;
	/** The icon shown in dark mode, as a data URL. */
	readonly iconDark?: string;
	readonly builtIn: boolean;
	readonly core: boolean;
	readonly enabled: boolean;
	/** Why the plugin could not be loaded; its contributions are hidden while set. */
	readonly error?: string;
	readonly contributes: Readonly<Record<PluginKind, readonly string[]>>;
	readonly settings: readonly ProviderManifestSetting[];
}

/** A plugin listed in the remote catalog (`index.json` of the kucedr-plugins repo). */
export interface CatalogPlugin {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly author?: string;
	readonly categories: readonly string[];
	/** An https URL. */
	readonly icon?: string;
	readonly version: string;
	readonly minAppVersion?: string;
	readonly url: string;
	/** `sha512-` plus the base64 SHA-512 of the archive at `url`. */
	readonly integrity: string;
	readonly contains: readonly PluginKind[];
}

/** A catalog plugin that isn't installed, or whose catalog version is newer than the installed one. */
export interface AvailablePlugin extends CatalogPlugin {
	readonly update: boolean;
}
