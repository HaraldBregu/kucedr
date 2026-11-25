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
	BrowserVisit,
} from './browser_import';

// How a tab connects: the shared profile with logins, a disposable private profile, or a
// disposable profile sent through Tor or the user's proxy.
export const BROWSER_ROUTES = ['direct', 'private', 'tor', 'proxy'] as const;
export type BrowserRoute = (typeof BROWSER_ROUTES)[number];

export interface BrowserBlocked {
	readonly url: string;
	readonly reason: 'local' | 'secret' | 'route' | 'download';
}

export interface BrowserDownload {
	readonly file: string;
	readonly site: string;
	readonly state: 'asking' | 'saving' | 'done' | 'failed';
}

// What a site may ask for in the pane; every other request is denied without asking.
export type BrowserSitePermission = 'camera' | 'microphone' | 'location' | 'notifications';

export interface BrowserPermissionRequest {
	readonly site: string;
	readonly kinds: readonly BrowserSitePermission[];
}

export interface BrowserConnections {
	// host:port of a Tor SOCKS port; empty finds Tor Browser or the Tor service.
	readonly tor: string;
	// scheme://host:port of the user's proxy; empty when none.
	readonly proxy: string;
}

export interface BrowserPaneTab {
	readonly targetId: string;
	readonly chat: string;
	readonly url: string;
	readonly title: string;
	readonly loading: boolean;
	readonly order: number;
	readonly back: boolean;
	readonly forward: boolean;
	readonly route: BrowserRoute;
	readonly error?: string;
	readonly icon?: string;
	// A manual sign-in waiting for "Save password?"; never carries the password.
	readonly offer?: { readonly username: string; readonly site: string; readonly update: boolean };
	readonly blocked?: readonly BrowserBlocked[];
	readonly download?: BrowserDownload;
	readonly permission?: BrowserPermissionRequest;
}

export interface BrowserPaneState {
	readonly tabs: readonly BrowserPaneTab[];
	readonly acting: readonly string[];
}

export interface BrowserPaneCommand {
	readonly targetId?: string;
	readonly command: 'back' | 'forward' | 'reload' | 'stop' | 'navigate' | 'focus' | 'close' | 'new' | 'move';
	readonly url?: string;
	readonly chat?: string;
	readonly index?: number;
	readonly route?: BrowserRoute;
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
	// The autofill list's "Manage passwords" row was chosen in a tab this window shows.
	onManagePasswords(callback: () => void): () => void;
	sources(): Promise<BrowserSource[]>;
	importData(request: BrowserImportRequest): Promise<BrowserImportSummary>;
	importPicked(request: BrowserImportPick): Promise<BrowserImportSummary | null>;
	suggest(text: string): Promise<BrowserPlace[]>;
	bookmarks(): Promise<BrowserPlace[]>;
	bookmarksAdd(place: BrowserPlace): Promise<void>;
	bookmarksUpdate(url: string, place: BrowserPlace): Promise<void>;
	bookmarksDelete(url: string): Promise<void>;
	bookmarksClear(): Promise<boolean>;
	bookmarksExport(): Promise<boolean>;
	library(): Promise<BrowserLibraryCounts>;
	history(): Promise<BrowserVisit[]>;
	historyDelete(url: string): Promise<void>;
	historyClear(): Promise<boolean>;
	passwordsStatus(): Promise<BrowserPasswordStatus>;
	passwordsImport(): Promise<number | null>;
	passwordsList(): Promise<BrowserLogin[]>;
	passwordsClear(): Promise<boolean>;
	passwordsUpdate(id: string, change: BrowserLoginChange): Promise<void>;
	passwordsDelete(id: string): Promise<boolean>;
	passwordsOffer(targetId: string, answer: 'save' | 'never' | 'dismiss'): Promise<void>;
	passwordsNever(): Promise<string[]>;
	passwordsNeverRemove(site: string): Promise<void>;
	passwordsMatch(targetId: string): Promise<BrowserLogin[]>;
	passwordsFill(targetId: string, id: string): Promise<void>;
	downloadAnswer(targetId: string, answer: 'save' | 'cancel' | 'dismiss' | 'show'): Promise<void>;
	connections(): Promise<BrowserConnections>;
	connectionsSet(connections: BrowserConnections): Promise<void>;
	// The Tor address that answers now, or null.
	torFind(): Promise<string | null>;
	cursor(): Promise<boolean>;
	cursorSet(enabled: boolean): Promise<void>;
}
