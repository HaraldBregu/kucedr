import type { AppWindowSettings } from './app_window_settings';

export type AppMetadata = {
	version: string;
	category: string;
	entry: string;
	image?: string;
	[key: string]: unknown;
};

export type AppManifest = {
	title: string;
	description: string;
	metadata: AppMetadata;
	window?: AppWindowSettings;
};

export type App = AppManifest & {
	id: string;
	imageUrl?: string;
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
