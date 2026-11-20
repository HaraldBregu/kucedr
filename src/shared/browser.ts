import type {
	BrowserImportPick,
	BrowserImportRequest,
	BrowserImportSummary,
	BrowserLogin,
	BrowserLoginChange,
	BrowserPasswordStatus,
	BrowserLibraryCounts,
	BrowserPlace,
	BrowserSource,
} from './browser_import';

export interface BrowserPaneTab {
	readonly targetId: string;
	readonly chat: string;
	readonly url: string;
	readonly title: string;
	readonly loading: boolean;
	readonly order: number;
	readonly back: boolean;
	readonly forward: boolean;
	readonly error?: string;
	readonly icon?: string;
}

export interface BrowserPaneState {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: readonly string[];
}

export interface BrowserPaneCommand {
	readonly targetId: string;
	readonly command: 'back' | 'forward' | 'reload' | 'stop' | 'navigate' | 'focus' | 'close' | 'new';
	readonly url?: string;
}

export interface BrowserPaneView {
	readonly targetId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface BrowserPaneApi {
	state(): Promise<BrowserPaneState>;
	command(request: BrowserPaneCommand): Promise<void>;
	view(request: BrowserPaneView | null): void;
	onChanged(callback: (state: BrowserPaneState) => void): () => void;
	sources(): Promise<BrowserSource[]>;
	importData(request: BrowserImportRequest): Promise<BrowserImportSummary>;
	importPicked(request: BrowserImportPick): Promise<BrowserImportSummary | null>;
	suggest(text: string): Promise<BrowserPlace[]>;
	bookmarks(): Promise<BrowserPlace[]>;
	library(): Promise<BrowserLibraryCounts>;
	clearLibrary(): Promise<void>;
	passwordsStatus(): Promise<BrowserPasswordStatus>;
	passwordsImport(): Promise<number | null>;
	passwordsList(): Promise<BrowserLogin[]>;
	passwordsClear(): Promise<boolean>;
	passwordsUpdate(id: string, change: BrowserLoginChange): Promise<void>;
	passwordsDelete(id: string): Promise<boolean>;
	passwordsMatch(targetId: string): Promise<BrowserLogin[]>;
	passwordsFill(targetId: string, id: string): Promise<void>;
}
