export interface BrowserSource {
	readonly id: string;
	readonly browser: string;
	readonly profile: string;
}

export interface BrowserPlace {
	readonly url: string;
	readonly title: string;
}

export interface BrowserImportRequest {
	readonly sources: readonly string[];
	readonly bookmarks: boolean;
	readonly history: boolean;
	readonly settings: boolean;
}

export interface BrowserImportSummary {
	readonly bookmarks: number;
	readonly history: number;
	readonly search?: string;
	readonly errors: readonly string[];
}

export interface BrowserLibraryCounts {
	readonly bookmarks: number;
	readonly history: number;
	readonly search: string;
}
