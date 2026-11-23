export interface BrowserSource {
	readonly id: string;
	readonly app: string;
	readonly profile: string;
	readonly folder: string;
	readonly kinds: readonly ('bookmarks' | 'history')[];
	readonly used: number;
}

export interface BrowserPlace {
	readonly url: string;
	readonly title: string;
}

export interface BrowserVisit extends BrowserPlace {
	readonly visits: number;
	readonly last: number;
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

export interface BrowserLogin {
	readonly id: string;
	readonly url: string;
	readonly username: string;
	readonly savedFor?: string;
}

// An empty password keeps the one saved.
export interface BrowserLoginChange {
	readonly url: string;
	readonly username: string;
	readonly password: string;
}

export interface BrowserPasswordStatus {
	readonly available: boolean;
	readonly count: number;
}

export interface BrowserLibraryCounts {
	readonly bookmarks: number;
	readonly history: number;
	readonly search: string;
}
