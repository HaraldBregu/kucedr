export interface BrowserSource {
	readonly id: string;
	readonly app: string;
	readonly profile: string;
	readonly kinds: readonly ('bookmarks' | 'history')[];
	readonly used: number;
}

export interface BrowserPlace {
	readonly url: string;
	readonly title: string;
}

export interface BrowserImportKinds {
	readonly bookmarks: boolean;
	readonly history: boolean;
	readonly settings: boolean;
}

export interface BrowserImportRequest extends BrowserImportKinds {
	readonly sources: readonly string[];
}

export interface BrowserImportPick extends BrowserImportKinds {
	readonly folder: boolean;
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
