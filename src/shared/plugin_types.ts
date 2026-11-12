import type { PluginManifest } from './plugin_manifest';
export const PLUGIN_KINDS = ['apps', 'mcp', 'providers', 'skills', 'scripts', 'modes'] as const;

/** The built-in plugin that ships Kucedr's own apps, MCP servers, and skills; it can't be disabled or replaced. */
export const CORE_PLUGIN_ID = 'bootstrap';

export type PluginKind = (typeof PLUGIN_KINDS)[number];

/** The plugin that contributed a catalog entry; absent for bundled and user entries. */
export interface PluginSource {
	readonly id: string;
	readonly name: string;
	readonly version?: string;
}

export interface PluginInfo {
	readonly id: string;
	readonly name: string;
	readonly version?: string;
	readonly description?: string;
	readonly categories: readonly string[];
	readonly author?: string;
	readonly website?: string;
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
	readonly settings?: PluginManifest['settings'];
}

/** A plugin script the renderer can frame, from `<plugin>/scripts/<name>/manifest.json`. */
/** The subset of JSON Schema a script's `inputSchema` uses to describe its properties. */
export interface PluginScriptSchema {
	readonly type?: string;
	readonly title?: string;
	readonly description?: string;
	/** `directory` adds a folder picker to a text setting. */
	readonly format?: string;
	readonly enum?: readonly string[];
	readonly default?: unknown;
	readonly required?: readonly string[];
	readonly properties?: Readonly<Record<string, PluginScriptSchema>>;
	readonly items?: PluginScriptSchema;
	readonly minimum?: number;
	readonly maximum?: number;
	readonly minItems?: number;
	readonly maxItems?: number;
	/** For a list of free-form rows: the fields every row has, each named by a path into the input (`xKey`, `series.key`). */
	readonly keys?: readonly { readonly from: string; readonly type: string }[];
	readonly examples?: readonly unknown[];
}

/** Where a script runs: `UI` renders inside chats and documents, `STORAGE` syncs files with cloud storage, `VECTOR` mirrors the Knowledge index to a vector database, `PRE_TOOL_USE` and `POST_TOOL_USE` run before and after every agent tool call, `PRE_MODEL_TURN` and `POST_MODEL_TURN` before and after every agent model turn. */
export const PLUGIN_SCRIPT_TYPES = [
	'UI',
	'STORAGE',
	'VECTOR',
	'PRE_TOOL_USE',
	'POST_TOOL_USE',
	'PRE_MODEL_TURN',
	'POST_MODEL_TURN',
] as const;

export type PluginScriptType = (typeof PLUGIN_SCRIPT_TYPES)[number];

export const PLUGIN_SERVICE_TYPES = ['SEARCH_ENGINE'] as const;

export interface PluginScriptInfo {
	readonly name: string;
	readonly title: string;
	readonly description: string;
	readonly type: PluginScriptType;
	readonly author?: string;
	readonly version: string;
	readonly category: string;
	readonly inputSchema?: PluginScriptSchema;
	/** The setup the user fills in Settings → Scripts, from the manifest's `settings.inputSchema`. */
	readonly settings?: PluginScriptSchema;
	readonly fence?: string;
	readonly height: number;
	readonly plugin: PluginSource;
}

/** A plugin listed in the remote catalog (`index.json` of the kucedr-plugins repo). */
export interface CatalogPlugin {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly author: string;
	readonly website?: string;
	readonly categories: readonly string[];
	/** An https URL. */
	readonly icon?: string;
	/** The icon shown in dark mode, as an https URL. */
	readonly iconDark?: string;
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
