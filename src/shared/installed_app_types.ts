import type { AppWindowSettings } from './app_window_settings';
import type { PluginSource } from './plugin_types';

export type AppMetadata = {
	version: string;
	category: string;
	entry: string;
	image?: string;
	[key: string]: unknown;
};

export type AppManifest = {
	title: string;
	handle?: string;
	description: string;
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
