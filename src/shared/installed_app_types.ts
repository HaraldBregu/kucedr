import type { AppWindowSettings } from './app_window_settings';
import type { PluginSource } from './plugin_types';

export type AppMetadata = {
	version: string;
	category: string;
	entry: string;
	image?: string;
	[key: string]: unknown;
};

export const APP_MODES = ['extension', 'window'] as const;

/** Where an app opens: inside Kucedr or in its own window (extension by default). */
export type AppMode = (typeof APP_MODES)[number];

export type AppManifest = {
	title: string;
	handle?: string;
	description: string;
	/** Defaults to `extension`. */
	mode?: AppMode;
	metadata: AppMetadata;
	window?: AppWindowSettings;
};

export type App = AppManifest & {
	id: string;
	imageUrl?: string;
	debugPath?: string;
	/** Set when an installed plugin contributes this app. */
	plugin?: PluginSource;
};

export interface AppImportSkipped {
	name: string;
	sourcePath: string;
	reason: string;
}

export interface AppImportResult {
	imported: App[];
	skipped: AppImportSkipped[];
}
